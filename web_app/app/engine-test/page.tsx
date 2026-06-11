"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { createStockfishNnue } from "@/lib/engines/stockfish-nnue";
import type { Engine } from "@/lib/engines/types";
import { analyzeGameClient } from "@/lib/analysis/analyzeGameClient";
import type { Blunder } from "@/lib/supabase";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ANALYSIS_DEPTH = 18;
// Same depth the analysis page uses, so this exercises the production pipeline.
const GAME_ANALYSIS_DEPTH = 12;

interface EvalState {
  whiteCp: number | null;
  // Plies to mate from white's perspective: positive = white mates.
  mate: number | null;
  depth: number;
  bestmove: string | null;
}

function parseInput(
  raw: string
): { fen: string; kind: "fen" | "pgn" } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "Enter a FEN or PGN." };
  try {
    const chess = new Chess(text);
    return { fen: chess.fen(), kind: "fen" };
  } catch {
    // Not a FEN — try PGN, using the final position.
    try {
      const chess = new Chess();
      chess.loadPgn(text);
      return { fen: chess.fen(), kind: "pgn" };
    } catch {
      return { error: "Could not parse input as FEN or PGN." };
    }
  }
}

function formatEval(state: EvalState): string {
  if (state.mate !== null) {
    const side = state.mate > 0 ? "White" : "Black";
    return `${side} mates in ${Math.abs(state.mate)}`;
  }
  if (state.whiteCp !== null) {
    const pawns = state.whiteCp / 100;
    return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
  }
  return "—";
}

export default function EngineTestPage() {
  const [input, setInput] = useState("");
  const [fen, setFen] = useState(START_FEN);
  const [parseError, setParseError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [evalState, setEvalState] = useState<EvalState | null>(null);
  const [isPgn, setIsPgn] = useState(false);
  const [gameColor, setGameColor] = useState<"white" | "black">("white");
  const [gameAnalyzing, setGameAnalyzing] = useState(false);
  const [gameBlunders, setGameBlunders] = useState<Blunder[] | null>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleLoad = (raw: string) => {
    setInput(raw);
    const result = parseInput(raw);
    if ("error" in result) {
      setParseError(raw.trim() ? result.error : null);
      setIsPgn(false);
    } else {
      setParseError(null);
      setFen(result.fen);
      setIsPgn(result.kind === "pgn");
      setEvalState(null);
      setEngineError(null);
      setGameBlunders(null);
    }
  };

  const getEngine = async (): Promise<Engine> => {
    if (!engineRef.current) {
      engineRef.current = createStockfishNnue();
    }
    await engineRef.current.ready();
    return engineRef.current;
  };

  const handleAnalyzeGame = async () => {
    if (gameAnalyzing || analyzing) return;
    setGameAnalyzing(true);
    setEngineError(null);
    setGameBlunders(null);
    try {
      const engine = await getEngine();
      const blunders = await analyzeGameClient(
        input,
        gameColor,
        100,
        GAME_ANALYSIS_DEPTH,
        engine
      );
      setGameBlunders(blunders ?? []);
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : String(err));
    } finally {
      setGameAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setEngineError(null);
    setEvalState(null);

    // UCI scores are from the side-to-move's perspective; normalize to white's.
    const sign = fen.split(" ")[1] === "b" ? -1 : 1;

    try {
      if (!engineRef.current) {
        engineRef.current = createStockfishNnue();
        await engineRef.current.ready();
      }
      const result = await engineRef.current.search(fen, {
        depth: ANALYSIS_DEPTH,
        onIteration: (info) => {
          setEvalState({
            whiteCp: info.scoreCp !== undefined ? sign * info.scoreCp : null,
            mate: info.mateIn !== undefined ? sign * info.mateIn : null,
            depth: info.depth,
            bestmove: info.pv?.[0] ?? null,
          });
        },
      });
      setEvalState({
        whiteCp: result.scoreCp !== undefined ? sign * result.scoreCp : null,
        mate: result.mateIn !== undefined ? sign * result.mateIn : null,
        depth: result.depth ?? ANALYSIS_DEPTH,
        bestmove: result.bestmove ?? null,
      });
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Engine Test</h1>

      <textarea
        data-testid="position-input"
        value={input}
        onChange={(e) => handleLoad(e.target.value)}
        placeholder="Paste a FEN or PGN…"
        rows={4}
        className="w-full max-w-xl rounded border border-white/20 bg-transparent p-3 font-mono text-sm"
      />
      {parseError && (
        <p data-testid="parse-error" className="text-sm text-red-400">
          {parseError}
        </p>
      )}

      <div className="w-full max-w-md">
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            darkSquareStyle: { backgroundColor: "#5994EF" },
            lightSquareStyle: { backgroundColor: "#F2F6FA" },
          }}
        />
      </div>
      <p className="max-w-xl break-all font-mono text-xs opacity-60">{fen}</p>

      <div className="flex items-center gap-4">
        <button
          data-testid="analyze-button"
          onClick={handleAnalyze}
          disabled={analyzing || gameAnalyzing}
          className="rounded bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {analyzing ? "ANALYZING…" : "ANALYZE"}
        </button>

        {isPgn && (
          <>
            <select
              data-testid="game-color"
              value={gameColor}
              onChange={(e) => setGameColor(e.target.value as "white" | "black")}
              className="rounded border border-white/20 bg-transparent px-3 py-3 text-sm"
            >
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
            <button
              data-testid="analyze-game-button"
              onClick={handleAnalyzeGame}
              disabled={analyzing || gameAnalyzing}
              className="rounded bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {gameAnalyzing ? "ANALYZING GAME…" : "ANALYZE GAME"}
            </button>
          </>
        )}
      </div>

      {engineError && (
        <p data-testid="engine-error" className="max-w-xl text-sm text-red-400">
          {engineError}
        </p>
      )}

      {gameBlunders !== null && (
        <div
          data-testid="game-analysis"
          data-blunder-count={gameBlunders.length}
          className="flex w-full max-w-xl flex-col gap-2 rounded border border-white/20 px-6 py-4"
        >
          <span className="font-bold">
            {gameBlunders.length} blunder{gameBlunders.length !== 1 ? "s" : ""} found ({gameColor})
          </span>
          {gameBlunders.map((b, i) => (
            <div
              key={i}
              data-testid="game-blunder"
              data-move-played={b.move_played}
              data-eval-drop={b.eval_drop}
              className="flex justify-between font-mono text-sm opacity-80"
            >
              <span>
                #{b.move_number} played {b.move_played}, best {b.best_move}
              </span>
              <span>-{b.eval_drop} cp</span>
            </div>
          ))}
        </div>
      )}

      {evalState && (
        <div
          data-testid="engine-eval"
          data-eval-cp={evalState.whiteCp ?? ""}
          data-mate={evalState.mate ?? ""}
          data-depth={evalState.depth}
          data-bestmove={evalState.bestmove ?? ""}
          className="flex flex-col items-center gap-1 rounded border border-white/20 px-8 py-4"
        >
          <span className="text-3xl font-bold">{formatEval(evalState)}</span>
          <span className="text-sm opacity-70">
            depth {evalState.depth}
            {evalState.bestmove ? ` · best move ${evalState.bestmove}` : ""}
          </span>
        </div>
      )}
    </main>
  );
}
