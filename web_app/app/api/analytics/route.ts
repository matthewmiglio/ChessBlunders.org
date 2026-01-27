import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

// Simple client for analytics - doesn't need auth/cookies
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer, visitorId, sessionId } = body;

    const headersList = await headers();
    const ua = headersList.get("user-agent") || null;
    const forwardedFor = headersList.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    // Hash IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    // Get geo data from Vercel headers (if available)
    const city = headersList.get("x-vercel-ip-city") || null;
    const state = headersList.get("x-vercel-ip-country-region") || null;
    const country = headersList.get("x-vercel-ip-country") || null;

    const insertData = {
      path,
      referrer,
      visitor_id: visitorId,
      session_id: sessionId,
      ua,
      ip_hash: ipHash,
      city,
      state,
      country,
    };

    const { error } = await supabase.from("analytics").insert(insertData);

    if (error) {
      console.error("[Analytics API] Insert error:", error.message);
      return NextResponse.json(
        { error: "Failed to track", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return NextResponse.json(
      { error: "Internal error", details: String(error) },
      { status: 500 }
    );
  }
}
