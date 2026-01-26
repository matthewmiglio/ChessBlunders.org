import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";

const MAX_FREE_ANALYSES = 100;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check premium status
  const isPremium = await checkPremiumAccess();

  // Get total games count
  const { count: totalGames } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get analyzed games count (games that have an analysis)
  const { count: analyzedGames } = await supabase
    .from("analysis")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    totalGames: totalGames || 0,
    analyzedGames: analyzedGames || 0,
    isPremium,
    retentionLimit: isPremium ? null : MAX_FREE_ANALYSES,
  });
}
