import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkPremiumAccess } from "@/lib/premium";
import { FREE_MONTHLY_ANALYSES, currentMonthStart, nextMonthStart } from "@/lib/limits";

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

  // Analyses this calendar month, which is what the free limit counts
  const { count: analyzedThisMonth } = await supabase
    .from("analysis")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("analyzed_at", currentMonthStart().toISOString());

  return NextResponse.json({
    totalGames: totalGames || 0,
    analyzedGames: analyzedGames || 0,
    analyzedThisMonth: analyzedThisMonth || 0,
    isPremium,
    monthlyLimit: isPremium ? null : FREE_MONTHLY_ANALYSES,
    limitResetsAt: nextMonthStart().toISOString(),
  });
}
