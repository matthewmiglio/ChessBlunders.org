import { Chess } from "chess.js";
import type { Engine } from "@/lib/engines/types";
import type { Blunder, TopMove } from "@/lib/supabase";

// Client-side port of the retired Lambda-backed analyzeGame (formerly
// /api/analysis/single). Same Blunder output shape, with one fix: the old
// code normalized evals as if the engine score were white-POV, but UCI
// scores are side-to-move POV — which silently inverted evals for games
// the user played as black. Here both colors normalize correctly.

const MATE_SCORE = 10000;

interface PositionEval {
  /** Centipawns from the side-to-move's perspective (UCI convention). */
  eval: number;
  bestMove: string;
  topMoves: TopMove[];
}

function toCp(scoreCp?: number, mateIn?: number): number {
  if (mateIn !== undefined) return mateIn > 0 ? MATE_SCORE : -MATE_SCORE;
  return scoreCp ?? 0;
}

async function evaluatePosition(
  engine: Engine,
  fen: string,
  depth: number
): Promise<PositionEval | null> {
  try {
    const result = await engine.search(fen, { depth, multipv: 3 });
    const lines = result.lines?.length
      ? result.lines
      : [{ multipv: 1, depth: result.depth ?? 0, scoreCp: result.scoreCp, mateIn: result.mateIn, pv: result.pv }];

    const topMoves: TopMove[] = lines.map((line) => ({
      move: line.pv?.[0] || "",
      score: toCp(line.scoreCp, line.mateIn),
      pv: line.pv || [],
    }));

    return {
      eval: toCp(lines[0].scoreCp, lines[0].mateIn),
      bestMove: topMoves[0]?.move || "",
      topMoves,
    };
  } catch {
    return null;
  }
}

/** Evaluate a position the user just moved into; handles game-over endings without the engine. */
async function evaluateAfterMove(
  engine: Engine,
  chess: Chess,
  depth: number
): Promise<{ eval: number } | null> {
  if (chess.isGameOver()) {
    // Side to move is the opponent here.
    if (chess.isCheckmate()) return { eval: -MATE_SCORE };
    return { eval: 0 }; // stalemate / draw
  }
  const evaluated = await evaluatePosition(engine, chess.fen(), depth);
  return evaluated ? { eval: evaluated.eval } : null;
}

export interface AnalyzeGameOptions {
  /** Return true to abort; partial results are discarded (null returned). */
  isAborted?: () => boolean;
}

/**
 * Analyze a game in the browser and return the user's blunders,
 * or null if aborted mid-game.
 */
export async function analyzeGameClient(
  pgn: string,
  userColor: string | null,
  threshold: number,
  depth: number,
  engine: Engine,
  options: AnalyzeGameOptions = {}
): Promise<Blunder[] | null> {
  const blunders: Blunder[] = [];
  const chess = new Chess();

  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }

  const moves = chess.history({ verbose: true });
  if (moves.length === 0) return [];

  chess.reset();

  const analyzeWhite = userColor === "white";
  let moveNumber = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isUserMove =
      (analyzeWhite && chess.turn() === "w") || (!analyzeWhite && chess.turn() === "b");

    if (isUserMove) {
      if (options.isAborted?.()) return null;

      const fenBefore = chess.fen();
      const evalBefore = await evaluatePosition(engine, fenBefore, depth);
      chess.move(move.san);

      if (evalBefore) {
        if (options.isAborted?.()) return null;
        const evalAfter = await evaluateAfterMove(engine, chess, depth);

        if (evalAfter) {
          // Before the user's move the user is the side to move; after it the
          // opponent is. Normalize both to the user's perspective.
          const evalBeforeNorm = evalBefore.eval;
          const evalAfterNorm = -evalAfter.eval;
          const evalDrop = evalBeforeNorm - evalAfterNorm;

          if (evalDrop >= threshold) {
            blunders.push({
              move_number: moveNumber,
              fen: fenBefore,
              move_played: move.san,
              best_move: evalBefore.bestMove,
              top_moves: evalBefore.topMoves,
              eval_before: evalBeforeNorm,
              eval_after: evalAfterNorm,
              eval_drop: evalDrop,
            });
          }
        }
      }
    } else {
      chess.move(move.san);
    }

    if (chess.turn() === "w") {
      moveNumber++;
    }
  }

  return blunders;
}
