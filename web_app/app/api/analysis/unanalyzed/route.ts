import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";

export const dynamic = "force-dynamic";

const MAX_FREE_ANALYSES = 100;

export async function GET() {
  try {
    console.log("[unanalyzed] Fetching unanalyzed games...");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log("[unanalyzed] Auth error or no user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPremium = await checkPremiumAccess();
    console.log(`[unanalyzed] isPremium=${isPremium}`);

    // Get all game IDs
    const { data: allGames, error: gamesError } = await supabase
      .from("games")
      .select("id, pgn, user_color")
      .eq("user_id", user.id);

    if (gamesError) {
      console.log("[unanalyzed] Error fetching games:", gamesError);
      return NextResponse.json({ error: gamesError.message }, { status: 500 });
    }

    // Get all analyzed game IDs
    const { data: analyzedGames, error: analyzedError } = await supabase
      .from("analysis")
      .select("game_id")
      .eq("user_id", user.id);

    if (analyzedError) {
      console.log("[unanalyzed] Error fetching analysis:", analyzedError);
      return NextResponse.json({ error: analyzedError.message }, { status: 500 });
    }

    const analyzedIds = new Set(analyzedGames?.map(a => a.game_id) || []);
    const alreadyAnalyzed = analyzedIds.size;
    const total = allGames?.length || 0;

    console.log(`[unanalyzed] total games=${total}, already analyzed=${alreadyAnalyzed}`);
    console.log(`[unanalyzed] Analyzed game IDs:`, Array.from(analyzedIds));

    // Filter to unanalyzed games
    let unanalyzedGames = (allGames || []).filter(g => !analyzedIds.has(g.id));
    console.log(`[unanalyzed] Unanalyzed games count=${unanalyzedGames.length}`);
    console.log(`[unanalyzed] Unanalyzed game IDs:`, unanalyzedGames.map(g => g.id));

    // For free users, cap at remaining slots
    let remainingSlots = null;
    if (!isPremium) {
      remainingSlots = Math.max(0, MAX_FREE_ANALYSES - alreadyAnalyzed);
      console.log(`[unanalyzed] Free user: remainingSlots=${remainingSlots}`);
      if (unanalyzedGames.length > remainingSlots) {
        console.log(`[unanalyzed] Capping unanalyzed to ${remainingSlots}`);
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
    console.log(`[unanalyzed] Returning:`, { ...result, games: `${unanalyzedGames.length} games` });

    return NextResponse.json(result);

  } catch (error) {
    console.error("[unanalyzed] Error:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
