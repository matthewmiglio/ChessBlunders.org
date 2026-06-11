"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { createStockfishNnue } from "@/lib/engines/stockfish-nnue";
import type { Engine } from "@/lib/engines/types";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const ANALYSIS_DEPTH = 18;

interface EvalState {
  whiteCp: number | null;
  // Plies to mate from white's perspective: positive = white mates.
  mate: number | null;
  depth: number;
  bestmove: string | null;
}

function parseInput(raw: string): { fen: string } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "Enter a FEN or PGN." };
  try {
    const chess = new Chess(text);
    return { fen: chess.fen() };
  } catch {
    // Not a FEN — try PGN, using the final position.
    try {
      const chess = new Chess();
      chess.loadPgn(text);
      return { fen: chess.fen() };
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
    } else {
      setParseError(null);
      setFen(result.fen);
      setEvalState(null);
      setEngineError(null);
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

      <button
        data-testid="analyze-button"
        onClick={handleAnalyze}
        disabled={analyzing}
        className="rounded bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {analyzing ? "ANALYZING…" : "ANALYZE"}
      </button>

      {engineError && (
        <p data-testid="engine-error" className="max-w-xl text-sm text-red-400">
          {engineError}
        </p>
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
