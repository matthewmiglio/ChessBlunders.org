import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { Chess } from "chess.js";
import { Blunder } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

const LAMBDA_URL = "https://0y0qc8c0hk.execute-api.us-east-1.amazonaws.com/prod/analyze";
const ANALYSIS_DEPTH = 18;
const CONCURRENCY_LIMIT = 5;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing running job
  const { data: existingJob } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingJob) {
    return NextResponse.json({
      jobId: existingJob.id,
      status: existingJob.status,
      current: existingJob.analyzed_games,
      total: existingJob.total_games,
      message: "Analysis already in progress",
    });
  }

  // Get all games using pagination (Supabase default limit is 1000)
  const allGames: { id: string; pgn: string; user_color: string | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, pgn, user_color")
      .eq("user_id", user.id)
      .range(offset, offset + PAGE_SIZE - 1);

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 });
    }

    if (!games || games.length === 0) break;
    allGames.push(...games);
    if (games.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Get all analyzed game IDs using pagination
  const allAnalyzedIds: string[] = [];
  offset = 0;

  while (true) {
    const { data: analyses } = await supabase
      .from("analysis")
      .select("game_id")
      .eq("user_id", user.id)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!analyses || analyses.length === 0) break;
    allAnalyzedIds.push(...analyses.map((a) => a.game_id));
    if (analyses.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const analyzedGameIds = new Set(allAnalyzedIds);
  const unanalyzedGames = allGames.filter((g) => !analyzedGameIds.has(g.id));

  if (unanalyzedGames.length === 0) {
    return NextResponse.json({ message: "All games already analyzed" });
  }

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs")
    .insert({
      user_id: user.id,
      status: "running",
      total_games: unanalyzedGames.length,
      analyzed_games: 0,
      failed_games: 0,
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Failed to create analysis job" }, { status: 500 });
  }

  // Run analysis in background after response is sent
  after(async () => {
    // Create a fresh supabase client for background work
    const bgSupabase = await createClient();
    let analyzed = 0;
    let failed = 0;

    try {
      // Process games in parallel batches
      for (let i = 0; i < unanalyzedGames.length; i += CONCURRENCY_LIMIT) {
        const batch = unanalyzedGames.slice(i, i + CONCURRENCY_LIMIT);

        const results = await Promise.allSettled(
          batch.map(async (game) => {
            const blunders = await analyzeGame(game.pgn, game.user_color, 100, bgSupabase, user.id);
            await bgSupabase.from("analysis").insert({
              game_id: game.id,
              user_id: user.id,
              blunders: blunders,
              threshold_cp: 100,
            });
            return game.id;
          })
        );

        // Count results
        for (const result of results) {
          if (result.status === "fulfilled") {
            analyzed++;
          } else {
            failed++;
            console.error("Failed to analyze game:", result.reason);
          }
        }

        // Update progress in database
        await bgSupabase.rpc("update_analysis_job_progress", {
          p_job_id: job.id,
          p_analyzed: analyzed,
          p_failed: failed,
        });
      }

      // Mark as completed
      await bgSupabase
        .from("analysis_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);

    } catch (error) {
      console.error("Background analysis error:", error);
      await bgSupabase
        .from("analysis_jobs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  });

  // Return immediately with job info
  return NextResponse.json({
    jobId: job.id,
    status: "running",
    current: 0,
    total: unanalyzedGames.length,
    message: "Analysis started in background",
  });
}

// Call Lambda to evaluate a position
async function evaluatePosition(fen: string): Promise<{ eval: number; bestMove: string } | null> {
  try {
    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen, depth: ANALYSIS_DEPTH }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.lines || data.lines.length === 0) return null;

    const line = data.lines[0];
    return {
      eval: line.score.mate !== undefined
        ? (line.score.mate > 0 ? 10000 : -10000)
        : line.score.cp,
      bestMove: line.pv?.[0] || "",
    };
  } catch (error) {
    console.error("Lambda evaluation error:", error);
    return null;
  }
}

// Analyze a game and find blunders
async function analyzeGame(
  pgn: string,
  userColor: string | null,
  threshold: number,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Blunder[]> {
  const blunders: Blunder[] = [];
  const chess = new Chess();

  // Load PGN
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    console.error("Failed to parse PGN:", error);
    return [];
  }

  // Get all moves
  const moves = chess.history({ verbose: true });
  if (moves.length === 0) return [];

  // Reset to starting position
  chess.reset();

  // Determine which side we're analyzing (w = white's turn means white just needs to move)
  const analyzeWhite = userColor === "white";
  let moveNumber = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isUserMove = (analyzeWhite && chess.turn() === "w") || (!analyzeWhite && chess.turn() === "b");

    if (isUserMove) {
      // Get position before the move
      const fenBefore = chess.fen();

      // Evaluate position before user's move
      const evalBefore = await evaluatePosition(fenBefore);

      // Track engine usage
      await supabase.rpc("increment_engine_usage", { p_user_id: userId });

      if (evalBefore) {
        // Make the user's move
        chess.move(move.san);

        // Get position after the move
        const fenAfter = chess.fen();

        // Evaluate position after user's move
        const evalAfter = await evaluatePosition(fenAfter);
        await supabase.rpc("increment_engine_usage", { p_user_id: userId });

        if (evalAfter) {
          // Normalize evals from user's perspective
          const evalBeforeNorm = analyzeWhite ? evalBefore.eval : -evalBefore.eval;
          const evalAfterNorm = analyzeWhite ? -evalAfter.eval : evalAfter.eval;

          // Calculate drop (positive = user lost advantage)
          const evalDrop = evalBeforeNorm - evalAfterNorm;

          if (evalDrop >= threshold) {
            blunders.push({
              move_number: moveNumber,
              fen: fenBefore,
              move_played: move.san,
              best_move: evalBefore.bestMove,
              eval_before: evalBeforeNorm,
              eval_after: evalAfterNorm,
              eval_drop: evalDrop,
            });
          }
        }
      } else {
        // Still need to make the move to continue
        chess.move(move.san);
      }
    } else {
      // Opponent's move - just make it
      chess.move(move.san);
    }

    // Update move number after black's move
    if (chess.turn() === "w") {
      moveNumber++;
    }
  }

  return blunders;
}
