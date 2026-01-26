import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    // Use RPC function - returns name but NOT email or user_id
    const { data: feedback, error } = await supabaseAdmin
      .rpc("get_feedback_list", { limit_count: 100 });

    if (error) {
      console.error("Feedback fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
