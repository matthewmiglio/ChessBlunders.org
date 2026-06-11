import type { SearchLimits, SearchResult } from "./types";

export interface UciWorker {
  postMessage(msg: string): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<string>) => void) | null;
  onerror?: ((e: ErrorEvent) => void) | null;
}

export class UciEngine {
  private listeners: Array<(line: string) => boolean> = [];
  private searchInFlight = false;

  constructor(private worker: UciWorker) {
    worker.onmessage = (e: MessageEvent<string>) => {
      const raw = typeof e.data === "string" ? e.data : (e as unknown as { data: string }).data;
      const lines = String(raw).split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const fn of [...this.listeners]) {
          if (fn(trimmed)) {
            this.listeners = this.listeners.filter((x) => x !== fn);
          }
        }
      }
    };
  }

  send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  waitFor(pred: (line: string) => boolean, timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const fn = (line: string): boolean => {
        if (pred(line)) {
          clearTimeout(timer);
          resolve(line);
          return true;
        }
        return false;
      };
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((x) => x !== fn);
        reject(new Error("UCI waitFor timeout"));
      }, timeoutMs);
      this.listeners.push(fn);
    });
  }

  async initUci(): Promise<void> {
    this.send("uci");
    await this.waitFor((l) => l === "uciok");
  }

  async isReady(): Promise<void> {
    this.send("isready");
    await this.waitFor((l) => l === "readyok");
  }

  async setOption(name: string, value: string | number): Promise<void> {
    this.send(`setoption name ${name} value ${value}`);
  }

  async newGame(): Promise<void> {
    this.send("ucinewgame");
    await this.isReady();
  }

  /** Interrupt any in-flight search. Returns once the engine has emitted `bestmove`. */
  async stop(): Promise<void> {
    if (!this.searchInFlight) return;
    this.send("stop");
    // The in-flight search() will resolve as soon as bestmove arrives, which flips searchInFlight off.
    // Wait a tick so subsequent callers can issue a new position+go without racing.
    await this.isReady();
  }

  async search(fen: string, limits: SearchLimits): Promise<SearchResult> {
    this.searchInFlight = true;
    const t0 = performance.now();
    const multipv = limits.multipv ?? 1;
    await this.setOption("MultiPV", multipv);
    this.send(`position fen ${fen}`);

    const infoLines: string[] = [];
    const parseInfo = (line: string) => {
      const tokens = line.split(/\s+/);
      const get = (key: string): string | undefined => {
        const i = tokens.indexOf(key);
        return i >= 0 ? tokens[i + 1] : undefined;
      };
      const depth = Number(get("depth"));
      if (!Number.isFinite(depth)) return null;
      const nodes = Number(get("nodes"));
      const nps = Number(get("nps"));
      const pvIndex = Number(get("multipv"));
      const scoreIdx = tokens.indexOf("score");
      let scoreCp: number | undefined;
      let mateIn: number | undefined;
      if (scoreIdx >= 0) {
        const kind = tokens[scoreIdx + 1];
        const val = Number(tokens[scoreIdx + 2]);
        if (kind === "cp") scoreCp = val;
        else if (kind === "mate") mateIn = val;
      }
      const bound = tokens.includes("lowerbound") || tokens.includes("upperbound");
      const pvIdx = tokens.indexOf("pv");
      const pv = pvIdx >= 0 ? tokens.slice(pvIdx + 1) : undefined;
      return {
        depth,
        multipv: Number.isFinite(pvIndex) && pvIndex > 0 ? pvIndex : 1,
        bound,
        scoreCp,
        mateIn,
        nodes: Number.isFinite(nodes) ? nodes : undefined,
        nps: Number.isFinite(nps) ? nps : undefined,
        pv,
      };
    };
    let lastSeenDepth = 0;
    // Latest complete (non-bound, with PV) info line per MultiPV index.
    const lastByPv = new Map<number, NonNullable<ReturnType<typeof parseInfo>>>();
    const collector = (line: string): boolean => {
      if (line.startsWith("info ")) {
        infoLines.push(line);
        const parsed = parseInfo(line);
        if (parsed && parsed.pv && parsed.pv.length && !parsed.bound) {
          lastByPv.set(parsed.multipv, parsed);
          if (limits.onIteration && parsed.multipv === 1 && parsed.depth > lastSeenDepth) {
            lastSeenDepth = parsed.depth;
            limits.onIteration({
              depth: parsed.depth,
              scoreCp: parsed.scoreCp,
              mateIn: parsed.mateIn,
              pv: parsed.pv,
              nodes: parsed.nodes,
              nps: parsed.nps,
              elapsedMs: performance.now() - t0,
            });
          }
        }
      }
      return line.startsWith("bestmove ");
    };
    this.listeners.push(collector);

    const goParts: string[] = ["go"];
    if (limits.depth !== undefined) goParts.push("depth", String(limits.depth));
    if (limits.movetime !== undefined) goParts.push("movetime", String(limits.movetime));
    if (limits.depth === undefined && limits.movetime === undefined) {
      goParts.push("depth", "12");
    }
    this.send(goParts.join(" "));

    const bestLine = await this.waitFor((l) => l.startsWith("bestmove "), 5 * 60_000);
    this.listeners = this.listeners.filter((x) => x !== collector);
    this.searchInFlight = false;

    const bestmove = bestLine.split(/\s+/)[1] ?? "(none)";

    // Fall back to the raw last info line if no complete PV line was seen
    // (e.g. terminal positions where the engine emits only "info depth 0 ...").
    let primary = lastByPv.get(1);
    if (!primary) {
      const last = infoLines[infoLines.length - 1] ?? "";
      primary = parseInfo(last) ?? undefined;
    }

    const lines = [...lastByPv.values()]
      .sort((a, b) => a.multipv - b.multipv)
      .map((l) => ({
        multipv: l.multipv,
        depth: l.depth,
        scoreCp: l.scoreCp,
        mateIn: l.mateIn,
        pv: l.pv,
      }));

    return {
      bestmove,
      scoreCp: primary?.scoreCp,
      mateIn: primary?.mateIn,
      depth: primary?.depth,
      nodes: primary?.nodes,
      nps: primary?.nps,
      elapsedMs: performance.now() - t0,
      pv: primary?.pv,
      lines: lines.length ? lines : undefined,
    };
  }

  async dispose() {
    try {
      this.send("quit");
    } catch {}
    this.worker.terminate();
  }
}
