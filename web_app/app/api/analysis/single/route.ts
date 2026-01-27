import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";
import { Chess } from "chess.js";
import { Blunder, TopMove } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1 minute max per game

const LAMBDA_URL = "https://0y0qc8c0hk.execute-api.us-east-1.amazonaws.com/prod/analyze";
const DEFAULT_ANALYSIS_DEPTH = 12;
const MAX_FREE_DEPTH = 12;
const MAX_PREMIUM_DEPTH = 25;
const MAX_FREE_ANALYSES = 100;

interface EvalResult {
  eval: number;
  bestMove: string;
  topMoves: TopMove[];
}

async function evaluatePosition(fen: string, depth: number): Promise<EvalResult | null> {
  try {
    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth, multipv: 3 }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.lines || data.lines.length === 0) return null;

    const primaryLine = data.lines[0];
    const primaryEval = primaryLine.score.mate !== undefined
      ? (primaryLine.score.mate > 0 ? 10000 : -10000)
      : primaryLine.score.cp;

    const topMoves: TopMove[] = data.lines.map((line: { score: { mate?: number; cp?: number }; pv?: string[] }) => ({
      move: line.pv?.[0] || "",
      score: line.score.mate !== undefined
        ? (line.score.mate > 0 ? 10000 : -10000)
        : line.score.cp ?? 0,
      pv: line.pv || [],
    }));

    return {
      eval: primaryEval,
      bestMove: topMoves[0]?.move || "",
      topMoves,
    };
  } catch (error) {
    console.error("Lambda evaluation error:", error);
    return null;
  }
}

async function analyzeGame(
  pgn: string,
  userColor: string | null,
  threshold: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  depth: number
): Promise<Blunder[]> {
  const blunders: Blunder[] = [];
  const chess = new Chess();

  try {
    chess.loadPgn(pgn);
  } catch (error) {
    console.error("Failed to parse PGN:", error);
    return [];
  }

  const moves = chess.history({ verbose: true });
  if (moves.length === 0) return [];

  chess.reset();

  const analyzeWhite = userColor === "white";
  let moveNumber = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isUserMove = (analyzeWhite && chess.turn() === "w") || (!analyzeWhite && chess.turn() === "b");

    if (isUserMove) {
      const fenBefore = chess.fen();
      const evalBefore = await evaluatePosition(fenBefore, depth);
      await supabase.rpc("increment_engine_usage", { p_user_id: userId });

      if (evalBefore) {
        chess.move(move.san);
        const fenAfter = chess.fen();
        const evalAfter = await evaluatePosition(fenAfter, depth);
        await supabase.rpc("increment_engine_usage", { p_user_id: userId });

        if (evalAfter) {
          const evalBeforeNorm = analyzeWhite ? evalBefore.eval : -evalBefore.eval;
          const evalAfterNorm = analyzeWhite ? -evalAfter.eval : evalAfter.eval;
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
      } else {
        chess.move(move.san);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, depth: requestedDepth } = body;

    if (!gameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already analyzed
    const { data: existingAnalysis } = await supabase
      .from("analysis")
      .select("id")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .single();

    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        alreadyAnalyzed: true,
        message: "Game already analyzed"
      });
    }

    // Check premium status for depth limits
    const isPremium = await checkPremiumAccess();
    const maxDepth = isPremium ? MAX_PREMIUM_DEPTH : MAX_FREE_DEPTH;
    const analysisDepth = Math.min(requestedDepth || DEFAULT_ANALYSIS_DEPTH, maxDepth);

    // Check retention limit for free users
    if (!isPremium) {
      const { count } = await supabase
        .from("analysis")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count || 0) >= MAX_FREE_ANALYSES) {
        return NextResponse.json({
          error: "Free analysis limit reached",
          limitReached: true,
        }, { status: 403 });
      }
    }

    // Fetch the game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, pgn, user_color")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Analyze the game
    const blunders = await analyzeGame(
      game.pgn,
      game.user_color,
      100, // threshold
      supabase,
      user.id,
      analysisDepth
    );

    // Save analysis
    const { error: insertError } = await supabase.from("analysis").insert({
      game_id: game.id,
      user_id: user.id,
      blunders: blunders,
      threshold_cp: 100,
    });

    if (insertError) {
      console.error(`[single] Game ${gameId}: Failed to save analysis:`, insertError);
      return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      blunders,
      blunderCount: blunders.length,
    });

  } catch (error) {
    console.error("[single] Analysis error:", error);
    return NextResponse.json({
      error: "Analysis failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
