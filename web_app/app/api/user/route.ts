import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/user - Get current user profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get stats
  const { data: stats } = await supabase.rpc("get_user_stats");

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      ...profile,
    },
    stats,
  });
}

// PATCH /api/user - Update user profile (chess username)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chessUsername } = await request.json();

    if (!chessUsername || typeof chessUsername !== "string") {
      return NextResponse.json(
        { error: "Valid chess username required" },
        { status: 400 }
      );
    }

    // Validate username exists on Chess.com
    const validateResponse = await fetch(
      `https://api.chess.com/pub/player/${chessUsername}`,
      {
        headers: {
          "User-Agent": "ChessBlunders.org/1.0",
        },
      }
    );

    if (!validateResponse.ok) {
      return NextResponse.json(
        { error: "Chess.com username not found" },
        { status: 400 }
      );
    }

    // Update using RPC
    const { data: success, error } = await supabase.rpc(
      "update_chess_username",
      { p_chess_username: chessUsername }
    );

    if (error || !success) {
      return NextResponse.json(
        { error: "Failed to update username" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, chessUsername });
  } catch (error) {
    console.error("Error updating username:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
