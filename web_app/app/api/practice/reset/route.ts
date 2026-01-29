import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST /api/practice/reset - Start a new practice run
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get current max practice_run for user
    const { data: runData } = await supabase
      .from("user_progress")
      .select("practice_run")
      .eq("user_id", user.id)
      .order("practice_run", { ascending: false })
      .limit(1)
      .single();

    const currentRun = runData?.practice_run || 1;
    const newRun = currentRun + 1;

    // We don't create any rows here - they'll be created when the user solves puzzles
    // The stored procedure record_practice_attempt will use the new run number
    // because it calculates currentRun as MAX(practice_run) + 1 when no rows exist for the new run

    // To ensure the new run is recognized, we need to insert a placeholder or
    // update the stored procedure logic. For simplicity, let's insert a "marker" row
    // that will be replaced when the user solves their first puzzle.
    // Actually, let's just update the user's profile to store current_practice_run
    // But that requires schema change. Instead, we'll create a dummy progress entry
    // that gets the new run started.

    // Simpler approach: The frontend will pass the new run number and the stored procedure
    // will use it. But that requires API changes.

    // Best approach for now: We'll return the new run number and the frontend
    // will track it. The stats API already returns current_practice_run from the
    // stored procedure which uses MAX(practice_run).

    // Actually, we need a way to "bump" the run. Let's create a special marker.
    // We'll create a progress entry with a special analysis_id that doesn't exist.
    // No - that's hacky.

    // The cleanest approach: Update the stored procedure to check if we want a new run.
    // For now, let's add a user_settings table or use the profiles table.

    // Simplest working solution: Store the desired run in user_progress with a null analysis_id
    // Actually that violates FK constraints.

    // Let's use RPC to handle this properly on the database side
    const { data: result, error } = await supabase.rpc("start_new_practice_run");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newPracticeRun: result?.new_practice_run || newRun,
      message: "Started new practice run",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reset practice" },
      { status: 500 }
    );
  }
}
