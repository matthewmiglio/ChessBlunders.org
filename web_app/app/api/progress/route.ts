import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// GET /api/progress - Get user's practice progress
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const analysisId = searchParams.get("analysisId");

  let query = supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id);

  if (analysisId) {
    query = query.eq("analysis_id", analysisId);
  }

  const { data: progress, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ progress });
}

// POST /api/progress - Record a practice attempt
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { analysisId, blunderIndex, solved } = await request.json();

    if (!analysisId || blunderIndex === undefined || solved === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: result, error } = await supabase.rpc(
      "record_practice_attempt",
      {
        p_analysis_id: analysisId,
        p_blunder_index: blunderIndex,
        p_solved: solved,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error recording progress:", error);
    return NextResponse.json(
      { error: "Failed to record progress" },
      { status: 500 }
    );
  }
}
