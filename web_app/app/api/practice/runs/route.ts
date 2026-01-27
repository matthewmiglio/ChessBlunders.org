import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export interface PracticeRunStats {
  practice_run: number;
  total_puzzles: number;
  solved_puzzles: number;
  first_try_solves: number;
  total_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
}

// GET /api/practice/runs - Get all practice run statistics
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

    // Get total blunders count from analysis
    const { data: analyses } = await supabase
      .from("analysis")
      .select("blunders")
      .eq("user_id", user.id);

    let totalBlunders = 0;
    (analyses || []).forEach((analysis) => {
      if (analysis.blunders && Array.isArray(analysis.blunders)) {
        totalBlunders += analysis.blunders.length;
      }
    });

    // Get all progress records grouped by practice run
    const { data: progressRecords } = await supabase
      .from("user_progress")
      .select("practice_run, solved, attempts, created_at, solved_at")
      .eq("user_id", user.id)
      .order("practice_run", { ascending: true });

    // Define record type
    type ProgressRecord = {
      practice_run: number;
      solved: boolean;
      attempts: number;
      created_at: string | null;
      solved_at: string | null;
    };

    // Group records by practice run
    const runMap = new Map<number, {
      records: ProgressRecord[];
      firstCreated: Date | null;
      lastSolved: Date | null;
    }>();

    (progressRecords || []).forEach((record) => {
      const run = record.practice_run || 1;
      if (!runMap.has(run)) {
        runMap.set(run, { records: [], firstCreated: null, lastSolved: null });
      }
      const runData = runMap.get(run)!;
      runData.records.push(record as ProgressRecord);

      if (record.created_at) {
        const createdDate = new Date(record.created_at);
        if (!runData.firstCreated || createdDate < runData.firstCreated) {
          runData.firstCreated = createdDate;
        }
      }
      if (record.solved && record.solved_at) {
        const solvedDate = new Date(record.solved_at);
        if (!runData.lastSolved || solvedDate > runData.lastSolved) {
          runData.lastSolved = solvedDate;
        }
      }
    });

    // Build stats for each run
    const runs: PracticeRunStats[] = [];

    runMap.forEach((runData, runNumber) => {
      const records = runData.records;
      const solvedRecords = records.filter(r => r.solved);
      const firstTrySolves = records.filter(r => r.solved && r.attempts === 1).length;
      const totalAttempts = records.reduce((sum, r) => sum + (r.attempts || 0), 0);

      const solvedCount = solvedRecords.length;
      const isComplete = solvedCount >= totalBlunders && totalBlunders > 0;

      runs.push({
        practice_run: runNumber,
        total_puzzles: totalBlunders,
        solved_puzzles: solvedCount,
        first_try_solves: firstTrySolves,
        total_attempts: totalAttempts,
        started_at: runData.firstCreated?.toISOString() || null,
        completed_at: isComplete ? runData.lastSolved?.toISOString() || null : null,
        is_complete: isComplete,
      });
    });

    // Sort by run number descending (most recent first)
    runs.sort((a, b) => b.practice_run - a.practice_run);

    return NextResponse.json({
      currentRun,
      totalBlunders,
      runs,
    });
  } catch (error) {
    console.error("Error fetching practice runs:", error);
    return NextResponse.json(
      { error: "Failed to fetch practice runs" },
      { status: 500 }
    );
  }
}
