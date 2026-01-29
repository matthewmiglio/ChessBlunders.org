import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/practice/stats - Get detailed practice run statistics
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get current practice run from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_practice_run")
      .eq("id", user.id)
      .single();

    const currentRun = profile?.current_practice_run || 1;

    // Get all progress records for current run
    const { data: progressRecords } = await supabase
      .from("user_progress")
      .select("analysis_id, blunder_index, solved, attempts, solved_at, created_at")
      .eq("user_id", user.id)
      .eq("practice_run", currentRun);

    // Get total blunders count from analysis
    const { data: analyses } = await supabase
      .from("analysis")
      .select("id, blunders, game_id")
      .eq("user_id", user.id);

    // Calculate total blunders and unique games
    let totalBlunders = 0;
    const gameIds = new Set<string>();

    (analyses || []).forEach((analysis) => {
      if (analysis.blunders && Array.isArray(analysis.blunders)) {
        totalBlunders += analysis.blunders.length;
      }
      if (analysis.game_id) {
        gameIds.add(analysis.game_id);
      }
    });

    const gamesWithBlunders = gameIds.size;

    // Calculate attempt breakdowns
    let solvedFirst = 0;
    let solvedSecond = 0;
    let solvedThirdPlus = 0;
    let totalSolved = 0;

    (progressRecords || []).forEach((record) => {
      if (record.solved) {
        totalSolved++;
        if (record.attempts === 1) {
          solvedFirst++;
        } else if (record.attempts === 2) {
          solvedSecond++;
        } else {
          solvedThirdPlus++;
        }
      }
    });

    // Calculate streaks (need to sort by solved_at)
    const solvedRecords = (progressRecords || [])
      .filter(r => r.solved && r.solved_at)
      .sort((a, b) => new Date(a.solved_at).getTime() - new Date(b.solved_at).getTime());

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // For current streak, we need records sorted by solved_at and check if attempts === 1
    solvedRecords.forEach((record) => {
      if (record.attempts === 1) {
        tempStreak++;
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    });

    // Current streak is the streak at the end
    currentStreak = tempStreak;

    // Get the earliest created_at for this run (when run started)
    const runRecords = (progressRecords || [])
      .filter(r => r.created_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const runStartedAt = runRecords.length > 0 ? runRecords[0].created_at : null;

    // Calculate puzzles remaining
    const puzzlesCompleted = totalSolved;
    const puzzlesRemaining = totalBlunders - puzzlesCompleted;
    const percentComplete = totalBlunders > 0
      ? Math.round((puzzlesCompleted / totalBlunders) * 100)
      : 0;

    return NextResponse.json({
      currentRun,
      // Progress
      puzzlesCompleted,
      totalBlunders,
      puzzlesRemaining,
      percentComplete,
      gamesWithBlunders,
      // Attempts breakdown
      solvedFirst,
      solvedSecond,
      solvedThirdPlus,
      // Streaks
      currentStreak,
      bestStreak,
      // Timing
      runStartedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch practice stats" },
      { status: 500 }
    );
  }
}
