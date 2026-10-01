import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { chessUsernameExists } from "@/lib/chess-username";

// GET /api/user/check-username?u=name - Does this Chess.com player exist?
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("u") || "";
  return NextResponse.json({ exists: await chessUsernameExists(username) });
}
