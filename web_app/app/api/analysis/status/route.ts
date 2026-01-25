import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the most recent job for this user
  const { data: job, error } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    return NextResponse.json({
      hasJob: false,
      status: null,
    });
  }

  return NextResponse.json({
    hasJob: true,
    jobId: job.id,
    status: job.status,
    current: job.analyzed_games,
    total: job.total_games,
    failed: job.failed_games,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    error: job.error,
  });
}
