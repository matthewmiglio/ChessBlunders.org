import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";

export const dynamic = "force-dynamic";

const MAX_FREE_ANALYSES = 100;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPremium = await checkPremiumAccess();

    // Get all game IDs
    const { data: allGames, error: gamesError } = await supabase
      .from("games")
      .select("id, pgn, user_color")
      .eq("user_id", user.id);

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 });
    }

    // Get all analyzed game IDs
    const { data: analyzedGames, error: analyzedError } = await supabase
      .from("analysis")
      .select("game_id")
      .eq("user_id", user.id);

    if (analyzedError) {
      return NextResponse.json({ error: analyzedError.message }, { status: 500 });
    }

    const analyzedIds = new Set(analyzedGames?.map(a => a.game_id) || []);
    const alreadyAnalyzed = analyzedIds.size;
    const total = allGames?.length || 0;

    // Filter to unanalyzed games
    let unanalyzedGames = (allGames || []).filter(g => !analyzedIds.has(g.id));

    // For free users, cap at remaining slots
    let remainingSlots = null;
    if (!isPremium) {
      remainingSlots = Math.max(0, MAX_FREE_ANALYSES - alreadyAnalyzed);
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
      limitReached: !isPremium && alreadyAnalyzed >= MAX_FREE_ANALYSES,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("[unanalyzed] Error:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
