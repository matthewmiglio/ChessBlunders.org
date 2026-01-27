import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  console.log("[Analytics API] POST request received");

  try {
    const body = await request.json();
    const { path, referrer, visitorId, sessionId } = body;

    console.log("[Analytics API] Request body:", {
      path,
      referrer,
      visitorId,
      sessionId,
    });

    const headersList = await headers();
    const ua = headersList.get("user-agent") || null;
    const forwardedFor = headersList.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    console.log("[Analytics API] Headers extracted:", {
      ua: ua?.substring(0, 50) + "...",
      forwardedFor,
      ip,
    });

    // Hash IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

    // Get geo data from Vercel headers (if available)
    const city = headersList.get("x-vercel-ip-city") || null;
    const state = headersList.get("x-vercel-ip-country-region") || null;
    const country = headersList.get("x-vercel-ip-country") || null;

    console.log("[Analytics API] Geo data:", { city, state, country });

    const supabase = await createClient();
    console.log("[Analytics API] Supabase client created");

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

    console.log("[Analytics API] Inserting data:", insertData);

    const { data, error } = await supabase.from("analytics").insert(insertData).select();

    if (error) {
      console.error("[Analytics API] Supabase insert error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return NextResponse.json(
        { error: "Failed to track", details: error.message },
        { status: 500 }
      );
    }

    console.log("[Analytics API] Insert successful:", data);
    return NextResponse.json({ success: true, inserted: data });
  } catch (error) {
    console.error("[Analytics API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal error", details: String(error) },
      { status: 500 }
    );
  }
}
