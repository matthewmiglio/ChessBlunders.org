import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";
import { Blunder } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_FREE_ANALYSES = 100;
const MAX_BLUNDERS_PER_GAME = 200;
const THRESHOLD_CP = 100;

// Analysis runs in the user's browser (lib/analysis/analyzeGameClient.ts);
// this route only persists the computed blunders, with the same ownership,
// dedupe, and free-tier checks the retired server-side analysis performed.

function isValidBlunder(b: unknown): b is Blunder {
  if (typeof b !== "object" || b === null) return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.move_number === "number" &&
    typeof o.fen === "string" &&
    o.fen.length < 120 &&
    typeof o.move_played === "string" &&
    o.move_played.length < 12 &&
    typeof o.best_move === "string" &&
    o.best_move.length < 12 &&
    typeof o.eval_before === "number" &&
    typeof o.eval_after === "number" &&
    typeof o.eval_drop === "number"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, blunders } = body;

    if (!gameId || !Array.isArray(blunders)) {
      return NextResponse.json(
        { error: "gameId and blunders[] required" },
        { status: 400 }
      );
    }

    if (blunders.length > MAX_BLUNDERS_PER_GAME || !blunders.every(isValidBlunder)) {
      return NextResponse.json({ error: "Invalid blunders payload" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already analyzed
    const { data: existingAnalysis } = await supabase
      .from("analysis")
      .select("id")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .single();

    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        alreadyAnalyzed: true,
        message: "Game already analyzed",
      });
    }

    // Check retention limit for free users
    const isPremium = await checkPremiumAccess();
    if (!isPremium) {
      const { count } = await supabase
        .from("analysis")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count || 0) >= MAX_FREE_ANALYSES) {
        return NextResponse.json(
          { error: "Free analysis limit reached", limitReached: true },
          { status: 403 }
        );
      }
    }

    // Verify the game belongs to the user
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const { error: insertError } = await supabase.from("analysis").insert({
      game_id: game.id,
      user_id: user.id,
      blunders,
      threshold_cp: THRESHOLD_CP,
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      blunderCount: blunders.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save analysis",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
