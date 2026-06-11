import { detectCapabilities } from "../capabilities";
import type { Engine, EngineInfo, SearchLimits, SearchResult } from "../types";
import { UciEngine, type UciWorker } from "../uci-driver";

const info: EngineInfo = {
  id: "stockfish-nnue",
  name: "Stockfish NNUE (multithreaded WASM)",
  description: "Stockfish 16 NNUE — multithreaded + SIMD + full NNUE.",
  needsCrossOriginIsolation: true,
};

const WORKER_URL = "/engines/stockfish-nnue/stockfish-nnue-16.js";

export interface StockfishNnueOptions {
  hashMb?: number;
  threads?: number;
}

export function createStockfishNnue(opts: StockfishNnueOptions = {}): Engine {
  let driver: UciEngine | null = null;
  let readyPromise: Promise<void> | null = null;

  const init = async (): Promise<UciEngine> => {
    if (driver) return driver;
    const caps = detectCapabilities();
    if (!caps.crossOriginIsolated) {
      throw new Error(
        "stockfish-nnue requires cross-origin isolation. Page is not crossOriginIsolated — check COOP/COEP headers.",
      );
    }
    const worker = new Worker(WORKER_URL) as unknown as UciWorker;
    driver = new UciEngine(worker);
    await driver.initUci();
    await driver.setOption("Threads", opts.threads ?? caps.threads);
    await driver.setOption("Hash", opts.hashMb ?? 64);
    // npm `stockfish` defaults Use NNUE = false (classical eval). Turn it on so
    // we actually get the NNUE strength the package name promises.
    await driver.setOption("Use NNUE", "true");
    await driver.setOption("EvalFile", "nn-5af11540bbfe.nnue");
    await driver.setOption("UCI_AnalyseMode", "true");
    await driver.newGame();
    return driver;
  };

  return {
    info,
    async ready() {
      if (!readyPromise) readyPromise = init().then(() => void 0);
      await readyPromise;
    },
    async search(fen: string, limits: SearchLimits): Promise<SearchResult> {
      const d = await init();
      return d.search(fen, limits);
    },
    async stop() {
      if (driver) await driver.stop();
    },
    async dispose() {
      await driver?.dispose();
      driver = null;
      readyPromise = null;
    },
  };
}
