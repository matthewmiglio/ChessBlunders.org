import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/games - Fetch user's games
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .eq("user_id", user.id)
    .order("played_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ games });
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
    const { months } = await request.json();

    // Generate list of year/month combinations to fetch
    const monthsToFetch: { year: number; month: number }[] = [];
    const now = new Date();

    // For week filter, we'll need to filter games after fetching
    const weekCutoff = months === "week" ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : null;

    if (months === "all") {
      // Fetch archives list from Chess.com
      const archivesUrl = `https://api.chess.com/pub/player/${profile.chess_username}/games/archives`;
      const archivesRes = await fetch(archivesUrl, {
        headers: { "User-Agent": "ChessBlunders.org/1.0" },
      });
      if (archivesRes.ok) {
        const archivesData = await archivesRes.json();
        for (const url of archivesData.archives || []) {
          const match = url.match(/\/(\d{4})\/(\d{2})$/);
          if (match) {
            monthsToFetch.push({ year: parseInt(match[1]), month: parseInt(match[2]) });
          }
        }
      }
    } else if (months === "week") {
      // Fetch current month, and previous month if we're in the first week
      monthsToFetch.push({ year: now.getFullYear(), month: now.getMonth() + 1 });
      if (now.getDate() <= 7) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        monthsToFetch.push({ year: prevMonth.getFullYear(), month: prevMonth.getMonth() + 1 });
      }
    } else {
      const numMonths = parseInt(months) || 1;
      for (let i = 0; i < numMonths; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsToFetch.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
      }
    }

    let totalGames = 0;
    let totalImported = 0;

    // Fetch games for each month
    for (const { year, month } of monthsToFetch) {
      const chessComUrl = `https://api.chess.com/pub/player/${profile.chess_username}/games/${year}/${month.toString().padStart(2, "0")}`;
      const response = await fetch(chessComUrl, {
        headers: { "User-Agent": "ChessBlunders.org/1.0" },
      });

      if (!response.ok) continue;

      const data = await response.json();
      let games = data.games || [];

      // Filter to last week if needed
      if (weekCutoff) {
        games = games.filter((game: any) => new Date(game.end_time * 1000) >= weekCutoff);
      }

      totalGames += games.length;

      if (games.length === 0) continue;

      // Transform games for our database
      const transformedGames = games.map((game: any) => {
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

      // Bulk insert games using RPC
      const { data: insertedCount, error } = await supabase.rpc(
        "bulk_insert_games",
        { p_games: transformedGames }
      );

      if (!error && insertedCount) {
        totalImported += insertedCount;
      }
    }

    return NextResponse.json({
      imported: totalImported,
      total: totalGames,
    });
  } catch (error) {
    console.error("Error importing games:", error);
    return NextResponse.json(
      { error: "Failed to import games" },
      { status: 500 }
    );
  }
}
