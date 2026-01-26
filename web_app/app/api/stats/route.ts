import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch games to calculate win/loss/draw correctly
  const { data: games } = await supabase
    .from("games")
    .select("id, result, user_color")
    .eq("user_id", user.id);

  // Calculate wins, losses, draws from result field
  const lossResults = ['resigned', 'abandoned', 'checkmated', 'timeout', 'loss'];
  const drawResults = ['repetition', 'stalemate', 'agreed', 'insufficient', '50move', 'timevsinsufficient', 'draw'];

  let gamesWon = 0;
  let gamesLost = 0;
  let gamesDrawn = 0;

  games?.forEach(g => {
    const result = g.result?.toLowerCase();
    if (result === 'win') {
      gamesWon++;
    } else if (lossResults.includes(result)) {
      gamesLost++;
    } else if (drawResults.includes(result)) {
      gamesDrawn++;
    }
  });

  const [
    { data: stats, error: statsError },
    { data: progressOverTime, error: progressError },
  ] = await Promise.all([
    supabase.rpc("get_detailed_user_stats"),
    supabase.rpc("get_progress_over_time", { p_interval: "week" }),
  ]);

  if (statsError || progressError) {
    return NextResponse.json(
      { error: statsError?.message || progressError?.message },
      { status: 500 }
    );
  }

  // Override the RPC values with correctly calculated ones
  const fixedStats = {
    ...stats,
    games_won: gamesWon,
    games_lost: gamesLost,
    games_drawn: gamesDrawn,
  };

  return NextResponse.json({ stats: fixedStats, progressOverTime });
}
