"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { DetailedStats, ProgressPeriod } from "@/lib/supabase";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatCard } from "@/components/StatCard";
import { MoveQualityChart } from "@/components/MoveQualityChart";
import { GameResultsCard } from "@/components/GameResultsCard";
import { WeeklyProgressChart } from "@/components/WeeklyProgressChart";

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [progressOverTime, setProgressOverTime] = useState<ProgressPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();

      console.log("[progress] Stats response:", data);
      console.log("[progress] Result counts from DB:", data._debug?.resultCounts);
      console.log("[progress] Sample games:", data._debug?.sampleGames);
      console.log("[progress] games_won:", data.stats?.games_won, "games_lost:", data.stats?.games_lost, "games_drawn:", data.stats?.games_drawn);

      if (!res.ok) {
        setError(data.error || "Failed to load stats");
        return;
      }

      setStats(data.stats);
      setProgressOverTime(data.progressOverTime || []);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading stats..." />;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-[#f44336] mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="text-[#b4b4b4] hover:text-[#f5f5f5] underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <p className="text-[#b4b4b4]">No stats available yet.</p>
      </div>
    );
  }

  const totalMoveAttempts =
    (stats.move_rank_distribution?.rank_1 || 0) +
    (stats.move_rank_distribution?.rank_2 || 0) +
    (stats.move_rank_distribution?.rank_3 || 0) +
    (stats.move_rank_distribution?.wrong || 0);

  const moveQualityData = totalMoveAttempts > 0 ? [
    {
      label: "Best Move (#1)",
      count: stats.move_rank_distribution?.rank_1 || 0,
      percent: Math.round(((stats.move_rank_distribution?.rank_1 || 0) / totalMoveAttempts) * 100),
      color: "bg-[#18be5d]",
    },
    {
      label: "#2 Move",
      count: stats.move_rank_distribution?.rank_2 || 0,
      percent: Math.round(((stats.move_rank_distribution?.rank_2 || 0) / totalMoveAttempts) * 100),
      color: "bg-[#3b82f6]",
    },
    {
      label: "#3 Move",
      count: stats.move_rank_distribution?.rank_3 || 0,
      percent: Math.round(((stats.move_rank_distribution?.rank_3 || 0) / totalMoveAttempts) * 100),
      color: "bg-[#eab308]",
    },
    {
      label: "Wrong",
      count: stats.move_rank_distribution?.wrong || 0,
      percent: Math.round(((stats.move_rank_distribution?.wrong || 0) / totalMoveAttempts) * 100),
      color: "bg-[#f44336]",
    },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5] mb-8">
        Your Practice Progress
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Games Imported"
          value={stats.total_games}
          sublabel={`${stats.analyzed_games} analyzed`}
        />
        <StatCard
          label="Blunders Found"
          value={stats.total_blunders}
          sublabel={`${stats.blunder_rate.toFixed(1)} per game`}
        />
        <StatCard
          label="Solve Rate"
          value={`${stats.solve_rate || 0}%`}
          sublabel={`${stats.solved_blunders} solved`}
          valueColor="text-[#18be5d]"
        />
        <StatCard
          label="First Try Rate"
          value={`${stats.first_try_rate || 0}%`}
          sublabel={`${stats.total_attempts} attempts`}
          valueColor="text-[#3b82f6]"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <MoveQualityChart data={moveQualityData} />
        <GameResultsCard
          gamesWon={stats.games_won}
          gamesLost={stats.games_lost}
          gamesDrawn={stats.games_drawn}
          gamesByTimeClass={stats.games_by_time_class}
        />
      </div>

      <div className="mb-8">
        <WeeklyProgressChart data={progressOverTime} />
      </div>

      <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#f5f5f5] mb-4">
          Recent Activity
        </h2>
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-3xl font-semibold text-[#f5f5f5]">
              {stats.attempts_last_7_days}
            </p>
            <p className="text-sm text-[#b4b4b4]">attempts in the last 7 days</p>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-3xl font-semibold text-[#18be5d]">
              {stats.blunders_solved_last_7_days}
            </p>
            <p className="text-sm text-[#b4b4b4]">blunders solved in the last 7 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
