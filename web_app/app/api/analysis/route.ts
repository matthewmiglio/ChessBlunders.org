import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/analysis - Get user's analyses
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const gameId = searchParams.get("gameId");

  let query = supabase
    .from("analysis")
    .select(`*, game:games(*)`)
    .eq("user_id", user.id);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  const { data: analyses, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sort by game played_at date, most recent first
  const sortedAnalyses = (analyses || []).sort((a, b) => {
    const dateA = a.game?.played_at ? new Date(a.game.played_at).getTime() : 0;
    const dateB = b.game?.played_at ? new Date(b.game.played_at).getTime() : 0;
    return dateB - dateA;
  });

  return NextResponse.json({ analyses: sortedAnalyses });
}

// POST /api/analysis - Analyze a game
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { gameId, threshold = 100 } = await request.json();

    if (!gameId) {
      return NextResponse.json(
        { error: "Game ID required" },
        { status: 400 }
      );
    }

    // Get the game
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .eq("user_id", user.id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Check if already analyzed
    const { data: existingAnalysis } = await supabase
      .from("analysis")
      .select("id")
      .eq("game_id", gameId)
      .single();

    if (existingAnalysis) {
      return NextResponse.json(
        { error: "Game already analyzed", analysisId: existingAnalysis.id },
        { status: 409 }
      );
    }

    // Parse PGN and analyze each position
    const blunders = await analyzeGame(game.pgn, game.user_color, threshold);

    // Store analysis
    const { data: analysis, error: insertError } = await supabase
      .from("analysis")
      .insert({
        game_id: gameId,
        user_id: user.id,
        blunders: blunders,
        threshold_cp: threshold,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}

// Helper function to analyze a game (placeholder)
async function analyzeGame(
  pgn: string,
  userColor: string | null,
  threshold: number
) {
  // TODO: Implement actual analysis using chess.js + engine API
  return [];
}
