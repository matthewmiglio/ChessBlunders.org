import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { Chess } from "chess.js";
import { Blunder } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

const LAMBDA_URL = "https://0y0qc8c0hk.execute-api.us-east-1.amazonaws.com/prod/analyze";
const ANALYSIS_DEPTH = 12;
const CONCURRENCY_LIMIT = 20;

export async function POST() {
  try {
    console.log("[analysis/all] POST request started");

    let supabase;
    try {
      supabase = await createClient();
      console.log("[analysis/all] Supabase client created");
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
    console.log("[analysis/all] User retrieved:", user?.id || "null");
  } catch (err) {
    console.error("[analysis/all] Exception getting user:", err);
    return NextResponse.json({ error: "Failed to get user", details: String(err) }, { status: 500 });
  }

  if (!user) {
    console.log("[analysis/all] No user found - unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing running job
  console.log("[analysis/all] Checking for existing job...");
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
    console.log("[analysis/all] Existing job check complete:", existingJob ? `found job ${existingJob.id}` : "no existing job");
  } catch (err) {
    console.error("[analysis/all] Exception checking existing job:", err);
    return NextResponse.json({ error: "Failed to check existing jobs", details: String(err) }, { status: 500 });
  }

  if (existingJob) {
    console.log("[analysis/all] Returning existing job info");
    return NextResponse.json({
      jobId: existingJob.id,
      status: existingJob.status,
      current: existingJob.analyzed_games,
      total: existingJob.total_games,
      message: "Analysis already in progress",
    });
  }

  // Get all games using pagination (Supabase default limit is 1000)
  console.log("[analysis/all] Fetching games...");
  const allGames: { id: string; pgn: string; user_color: string | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;

  try {
    while (true) {
      console.log(`[analysis/all] Fetching games page at offset ${offset}`);
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
      console.log(`[analysis/all] Fetched ${games.length} games, total: ${allGames.length}`);
      if (games.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (err) {
    console.error("[analysis/all] Exception fetching games:", err);
    return NextResponse.json({ error: "Failed to fetch games", details: String(err) }, { status: 500 });
  }
  console.log(`[analysis/all] Total games fetched: ${allGames.length}`);

  // Get all analyzed game IDs using pagination
  console.log("[analysis/all] Fetching analyzed game IDs...");
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
  console.log(`[analysis/all] Found ${allAnalyzedIds.length} already analyzed games`);

  const analyzedGameIds = new Set(allAnalyzedIds);
  const unanalyzedGames = allGames.filter((g) => !analyzedGameIds.has(g.id));
  console.log(`[analysis/all] Unanalyzed games: ${unanalyzedGames.length}`);

  if (unanalyzedGames.length === 0) {
    console.log("[analysis/all] All games already analyzed");
    return NextResponse.json({ message: "All games already analyzed" });
  }

  // Create job record
  console.log("[analysis/all] Creating job record...");
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
    console.log(`[analysis/all] Job created with ID: ${job.id}`);
  } catch (err) {
    console.error("[analysis/all] Exception creating job:", err);
    return NextResponse.json({ error: "Failed to create analysis job", details: String(err) }, { status: 500 });
  }

  // Run analysis in background after response is sent
  console.log("[analysis/all] Setting up background analysis...");
  after(async () => {
    console.log("[analysis/all:bg] Background analysis starting...");
    // Create a fresh supabase client for background work
    const bgSupabase = await createClient();
    let analyzed = 0;
    let failed = 0;

    try {
      // Process games in parallel batches
      console.log(`[analysis/all:bg] Processing ${unanalyzedGames.length} games in batches of ${CONCURRENCY_LIMIT}`);
      for (let i = 0; i < unanalyzedGames.length; i += CONCURRENCY_LIMIT) {
        const batch = unanalyzedGames.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`[analysis/all:bg] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}, games ${i + 1}-${i + batch.length}`);

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
            console.error("[analysis/all:bg] Failed to analyze game:", result.reason);
          }
        }

        // Update progress in database
        console.log(`[analysis/all:bg] Progress: ${analyzed} analyzed, ${failed} failed`);
        await bgSupabase.rpc("update_analysis_job_progress", {
          p_job_id: job.id,
          p_analyzed: analyzed,
          p_failed: failed,
        });
      }

      // Mark as completed
      console.log(`[analysis/all:bg] Analysis complete. Final: ${analyzed} analyzed, ${failed} failed`);
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
  console.log(`[analysis/all] Returning success response for job ${job.id}`);
  return NextResponse.json({
    jobId: job.id,
    status: "running",
    current: 0,
    total: unanalyzedGames.length,
    message: "Analysis started in background",
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
