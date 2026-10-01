import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";
import { FREE_MONTHLY_ANALYSES, currentMonthStart, fetchAllRows } from "@/lib/limits";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPremium = await checkPremiumAccess();

    // Get all game IDs
    const { data: allGames, error: gamesError } = await fetchAllRows<{ id: string; pgn: string; user_color: string }>(
      (from, to) => supabase
        .from("games")
        .select("id, pgn, user_color")
        .eq("user_id", user.id)
        .order("played_at", { ascending: false })
        .order("id")
        .range(from, to)
    );

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 });
    }

    // Get all analyzed game IDs
    const { data: analyzedGames, error: analyzedError } = await fetchAllRows<{ game_id: string; analyzed_at: string }>(
      (from, to) => supabase
        .from("analysis")
        .select("game_id, analyzed_at")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to)
    );

    if (analyzedError) {
      return NextResponse.json({ error: analyzedError.message }, { status: 500 });
    }

    const analyzedIds = new Set(analyzedGames.map(a => a.game_id));
    const alreadyAnalyzed = analyzedIds.size;
    const total = allGames.length;

    // Filter to unanalyzed games
    let unanalyzedGames = allGames.filter(g => !analyzedIds.has(g.id));

    // For free users, cap at this month's remaining slots
    let remainingSlots = null;
    if (!isPremium) {
      const monthStart = currentMonthStart().getTime();
      const analyzedThisMonth = analyzedGames.filter(a => new Date(a.analyzed_at).getTime() >= monthStart).length;
      remainingSlots = Math.max(0, FREE_MONTHLY_ANALYSES - analyzedThisMonth);
      if (unanalyzedGames.length > remainingSlots) {
        unanalyzedGames = unanalyzedGames.slice(0, remainingSlots);
      }
    }

    const result = {
      games: unanalyzedGames,
      total,
      alreadyAnalyzed,
      isPremium,
      remainingSlots,
      limitReached: remainingSlots === 0,
    };

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
