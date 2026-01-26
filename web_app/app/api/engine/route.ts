import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";

const ENGINE_API_URL = process.env.STOCKFISH_API_URL!;
const DAILY_LIMIT = parseInt(process.env.ENGINE_DAILY_LIMIT || "100");
const MAX_FREE_DEPTH = 12;
const MAX_PREMIUM_DEPTH = 25;

// POST /api/engine - Analyze a position with Stockfish
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit using RPC
  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "check_engine_rate_limit",
    { p_daily_limit: DAILY_LIMIT }
  );

  if (rateLimitError) {
    return NextResponse.json(
      { error: "Rate limit check failed" },
      { status: 500 }
    );
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Daily engine limit reached", limit: DAILY_LIMIT },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { fen, depth = 12, multipv = 1 } = body;

    if (!fen) {
      return NextResponse.json(
        { error: "FEN position required" },
        { status: 400 }
      );
    }

    // Check premium status for depth limits
    const isPremium = await checkPremiumAccess();
    const maxDepth = isPremium ? MAX_PREMIUM_DEPTH : MAX_FREE_DEPTH;
    const effectiveDepth = Math.min(depth, maxDepth);

    // Call our Stockfish Lambda
    const engineResponse = await fetch(ENGINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fen, depth: effectiveDepth, multipv }),
    });

    if (!engineResponse.ok) {
      return NextResponse.json(
        { error: "Engine request failed" },
        { status: 502 }
      );
    }

    const analysis = await engineResponse.json();

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Engine error:", error);
    return NextResponse.json(
      { error: "Engine analysis failed" },
      { status: 500 }
    );
  }
}

// GET /api/engine - Get remaining requests
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: remaining, error } = await supabase.rpc(
    "get_remaining_requests",
    { p_daily_limit: DAILY_LIMIT }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    remaining,
    limit: DAILY_LIMIT,
  });
}
