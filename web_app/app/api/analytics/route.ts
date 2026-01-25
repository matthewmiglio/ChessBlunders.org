import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

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

    const supabase = await createClient();

    const { error } = await supabase.from("analytics").insert({
      path,
      referrer,
      visitor_id: visitorId,
      session_id: sessionId,
      ua,
      ip_hash: ipHash,
      city,
      state,
      country,
    });

    if (error) {
      console.error("Analytics insert error:", error);
      return NextResponse.json({ error: "Failed to track" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
