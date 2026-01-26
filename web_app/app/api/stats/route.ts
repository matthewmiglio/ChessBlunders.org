import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    { data: stats, error: statsError },
    { data: progressOverTime, error: progressError },
  ] = await Promise.all([
    supabase.rpc("get_detailed_user_stats"),
    supabase.rpc("get_progress_over_time", { p_interval: "week" }),
  ]);

  if (statsError || progressError) {
    return NextResponse.json(
      { error: statsError?.message || progressError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ stats, progressOverTime });
}
