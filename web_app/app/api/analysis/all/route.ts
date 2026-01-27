import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";
import { Chess } from "chess.js";
import { Blunder, TopMove } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

const LAMBDA_URL = "https://0y0qc8c0hk.execute-api.us-east-1.amazonaws.com/prod/analyze";
const DEFAULT_ANALYSIS_DEPTH = 12;
const MAX_FREE_DEPTH = 12;
const MAX_PREMIUM_DEPTH = 25;
const CONCURRENCY_LIMIT = 20;
const MAX_FREE_ANALYSES = 100; // Total analyses a free user can retain

export async function POST(request: NextRequest) {
  try {
    // Parse optional depth from request body
    let requestedDepth = DEFAULT_ANALYSIS_DEPTH;
    try {
      const body = await request.json();
      if (body.depth) {
        requestedDepth = parseInt(body.depth) || DEFAULT_ANALYSIS_DEPTH;
      }
    } catch {
      // No body or invalid JSON - use default depth
    }

    // Check premium status for depth limits
    const isPremium = await checkPremiumAccess();
    const maxDepth = isPremium ? MAX_PREMIUM_DEPTH : MAX_FREE_DEPTH;
    const analysisDepth = Math.min(requestedDepth, maxDepth);

    let supabase;
    try {
      supabase = await createClient();
    } catch (err) {
      console.error("[analysis/all] Failed to create Supabase client:", err);
      return NextResponse.json({ error: "Failed to create database client", details: String(err) }, { status: 500 });
    }

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("[analysis/all] Auth error:", error);
      return NextResponse.json({ error: "Auth error", details: error.message }, { status: 401 });
    }
    user = data.user;
  } catch (err) {
    console.error("[analysis/all] Exception getting user:", err);
    return NextResponse.json({ error: "Failed to get user", details: String(err) }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing running job
  let existingJob;
  try {
    const { data, error: existingJobError } = await supabase
      .from("analysis_jobs")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Note: single() returns error when no rows found, which is expected
    if (existingJobError && existingJobError.code !== "PGRST116") {
      console.error("[analysis/all] Error checking existing job:", existingJobError);
    }
    existingJob = data;
  } catch (err) {
    console.error("[analysis/all] Exception checking existing job:", err);
    return NextResponse.json({ error: "Failed to check existing jobs", details: String(err) }, { status: 500 });
  }

  if (existingJob) {
    return NextResponse.json({
      jobId: existingJob.id,
      status: existingJob.status,
      current: existingJob.analyzed_games,
      total: existingJob.total_games,
      message: "Analysis already in progress",
    });
  }

  // Check retention limit for free users
  let existingAnalysesCount = 0;
  if (!isPremium) {
    const { count, error: countError } = await supabase
      .from("analysis")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      console.error("[analysis/all] Error counting analyses:", countError);
      return NextResponse.json({ error: "Failed to check analysis count" }, { status: 500 });
    }

    existingAnalysesCount = count || 0;

    if (existingAnalysesCount >= MAX_FREE_ANALYSES) {
      return NextResponse.json({
        error: "You have reached the free analysis limit (100 games)",
        upgrade: true,
        limit: MAX_FREE_ANALYSES,
        current: existingAnalysesCount,
      }, { status: 403 });
    }
  }

  // Get all games using pagination (Supabase default limit is 1000)
  const allGames: { id: string; pgn: string; user_color: string | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  try {
    while (true) {
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select("id, pgn, user_color")
        .eq("user_id", user.id)
        .range(offset, offset + PAGE_SIZE - 1);

      if (gamesError) {
        console.error("[analysis/all] Error fetching games:", gamesError);
        return NextResponse.json({ error: gamesError.message }, { status: 500 });
      }

      if (!games || games.length === 0) break;
      allGames.push(...games);
      if (games.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (err) {
    console.error("[analysis/all] Exception fetching games:", err);
    return NextResponse.json({ error: "Failed to fetch games", details: String(err) }, { status: 500 });
  }

  // Get all analyzed game IDs using pagination
  const allAnalyzedIds: string[] = [];
  offset = 0;

  try {
    while (true) {
      const { data: analyses, error: analysesError } = await supabase
        .from("analysis")
        .select("game_id")
        .eq("user_id", user.id)
        .range(offset, offset + PAGE_SIZE - 1);

      if (analysesError) {
        console.error("[analysis/all] Error fetching analyses:", analysesError);
        return NextResponse.json({ error: analysesError.message }, { status: 500 });
      }

      if (!analyses || analyses.length === 0) break;
      allAnalyzedIds.push(...analyses.map((a) => a.game_id));
      if (analyses.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (err) {
    console.error("[analysis/all] Exception fetching analyses:", err);
    return NextResponse.json({ error: "Failed to fetch analyses", details: String(err) }, { status: 500 });
  }

  const analyzedGameIds = new Set(allAnalyzedIds);
  let unanalyzedGames = allGames.filter((g) => !analyzedGameIds.has(g.id));

  if (unanalyzedGames.length === 0) {
    return NextResponse.json({ message: "All games already analyzed" });
  }

  // Cap unanalyzed games to remaining slots for free users
  if (!isPremium) {
    const remainingSlots = MAX_FREE_ANALYSES - existingAnalysesCount;
    if (unanalyzedGames.length > remainingSlots) {
      unanalyzedGames = unanalyzedGames.slice(0, remainingSlots);
    }
  }

  // Create job record
  let job;
  try {
    const { data, error: jobError } = await supabase
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

    if (jobError) {
      console.error("[analysis/all] Error creating job:", jobError);
      return NextResponse.json({ error: "Failed to create analysis job", details: jobError.message }, { status: 500 });
    }
    if (!data) {
      console.error("[analysis/all] No job data returned");
      return NextResponse.json({ error: "Failed to create analysis job - no data returned" }, { status: 500 });
    }
    job = data;
  } catch (err) {
    console.error("[analysis/all] Exception creating job:", err);
    return NextResponse.json({ error: "Failed to create analysis job", details: String(err) }, { status: 500 });
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
            const blunders = await analyzeGame(game.pgn, game.user_color, 100, bgSupabase, user.id, analysisDepth);
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
            console.error("[analysis/all:bg] Failed to analyze game:", result.reason);
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
      console.error("[analysis/all:bg] Background analysis error:", error);
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
    retention: !isPremium ? {
      current: existingAnalysesCount,
      limit: MAX_FREE_ANALYSES,
      afterJob: existingAnalysesCount + unanalyzedGames.length,
    } : null,
  });

  } catch (err) {
    console.error("[analysis/all] UNCAUGHT ERROR:", err);
    return NextResponse.json({
      error: "Unexpected server error",
      details: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }, { status: 500 });
  }
}

// Result from position evaluation
interface EvalResult {
  eval: number;
  bestMove: string;
  topMoves: TopMove[];
}

// Call Lambda to evaluate a position
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

// Analyze a game and find blunders
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
      const evalBefore = await evaluatePosition(fenBefore, depth);

      // Track engine usage
      await supabase.rpc("increment_engine_usage", { p_user_id: userId });

      if (evalBefore) {
        // Make the user's move
        chess.move(move.san);

        // Get position after the move
        const fenAfter = chess.fen();

        // Evaluate position after user's move
        const evalAfter = await evaluatePosition(fenAfter, depth);
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
              top_moves: evalBefore.topMoves,
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
