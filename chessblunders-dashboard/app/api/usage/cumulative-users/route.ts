import { supabaseAdmin } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  console.log("[cumulative-users] Starting RPC call...");

  const { data, error } = await supabaseAdmin.rpc("get_cumulative_users_over_time");

  console.log("[cumulative-users] RPC response:", { data, error, dataType: typeof data, isArray: Array.isArray(data) });

  if (error) {
    console.error("[cumulative-users] Error:", error);
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  if (!data) {
    console.log("[cumulative-users] No data returned, checking profiles table directly...");
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .not("created_at", "is", null)
      .limit(10);

    console.log("[cumulative-users] Direct profiles query:", { profiles, profilesError });
  }

  console.log("[cumulative-users] Returning data, length:", Array.isArray(data) ? data.length : "not array");
  return NextResponse.json(data || []);
}
