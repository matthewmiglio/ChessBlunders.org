import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { fetchAllRows } from "@/lib/limits";

// Importing "all" games walks every Chess.com monthly archive, which can take a while.
export const maxDuration = 300;

const INSERT_CHUNK = 500;

// GET /api/games - Fetch user's games
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const offset = parseInt(searchParams.get("offset") || "0");

    const gamesQuery = () => supabase
      .from("games")
      .select("*")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .order("id");

    // Only apply range if limit is specified (otherwise fetch all, paging past the 1000-row cap)
    const { data: games, error: gamesError } = limitParam
      ? await gamesQuery().range(offset, offset + parseInt(limitParam) - 1)
      : await fetchAllRows((from, to) => gamesQuery().range(from, to));

    if (gamesError) {
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
    }

    // Fetch analysis records separately to get analysis_id for each game.
    // Query by user rather than .in(gameIds): thousands of ids overflow the request URL.
    let analysisMap: Record<string, string> = {};

    if (games && games.length > 0) {
      const { data: analysisRecords, error: analysisError } = await fetchAllRows<{ id: string; game_id: string }>(
        (from, to) => supabase
          .from("analysis")
          .select("id, game_id")
          .eq("user_id", user.id)
          .order("id")
          .range(from, to)
      );

      if (!analysisError) {
        // On error, continue without analysis data rather than failing
        analysisMap = Object.fromEntries(analysisRecords.map(a => [a.game_id, a.id]));
      }
    }

    // Merge analysis_id into games
    const gamesWithAnalysis = games?.map(game => ({
      ...game,
      analysis_id: analysisMap[game.id] || null,
    }));

    return NextResponse.json({ games: gamesWithAnalysis });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/games - Import games from Chess.com
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's chess username from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("chess_username")
    .eq("id", user.id)
    .single();

  if (!profile?.chess_username) {
    return NextResponse.json(
      { error: "Chess.com username not set" },
      { status: 400 }
    );
  }

  try {
    const { count } = await request.json();

    // No import cap: the user picks how many recent games to pull, or "all"
    const requested = parseInt(count);
    const gameLimit = count === "all" ? Infinity : requested > 0 ? requested : 50;

    // Get archives list (sorted newest to oldest)
    const archivesUrl = `https://api.chess.com/pub/player/${profile.chess_username}/games/archives`;
    const archivesRes = await fetch(archivesUrl, {
      headers: { "User-Agent": "ChessBlunders.org/1.0" },
    });

    if (!archivesRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch game archives from Chess.com" },
        { status: 502 }
      );
    }

    const archivesData = await archivesRes.json();
    const archives: string[] = archivesData.archives || [];

    // Reverse to process newest months first
    archives.reverse();

    // Collect games until we hit the limit
    const allGames: any[] = [];

    for (const archiveUrl of archives) {
      if (allGames.length >= gameLimit) break;

      const response = await fetch(archiveUrl, {
        headers: { "User-Agent": "ChessBlunders.org/1.0" },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const games = data.games || [];

      // Sort by end_time descending (newest first) and add to collection
      games.sort((a: any, b: any) => b.end_time - a.end_time);

      for (const game of games) {
        if (allGames.length >= gameLimit) break;
        allGames.push(game);
      }
    }

    // Transform games for our database
    const transformedGames = allGames.map((game: any) => {
      const isWhite =
        game.white?.username?.toLowerCase() ===
        profile.chess_username?.toLowerCase();
      return {
        chess_game_id: game.uuid || game.url.split("/").pop(),
        pgn: game.pgn,
        opponent: isWhite ? game.black?.username : game.white?.username,
        user_color: isWhite ? "white" : "black",
        time_class: game.time_class,
        rated: game.rated,
        result: isWhite ? game.white?.result : game.black?.result,
        played_at: new Date(game.end_time * 1000).toISOString(),
      };
    });

    // Bulk insert games using RPC, in chunks so a full-history import stays a sane payload size
    let totalImported = 0;
    for (let i = 0; i < transformedGames.length; i += INSERT_CHUNK) {
      const { data: insertedCount, error } = await supabase.rpc(
        "bulk_insert_games",
        { p_games: transformedGames.slice(i, i + INSERT_CHUNK) }
      );

      if (!error && insertedCount) {
        totalImported += insertedCount;
      }
    }

    return NextResponse.json({
      imported: totalImported,
      total: allGames.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to import games" },
      { status: 500 }
    );
  }
}
