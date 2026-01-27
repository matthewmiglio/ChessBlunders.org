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

interface PracticeRunStats {
  practice_run: number;
  total_puzzles: number;
  solved_puzzles: number;
  first_try_solves: number;
  total_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
}

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [progressOverTime, setProgressOverTime] = useState<ProgressPeriod[]>([]);
  const [practiceRuns, setPracticeRuns] = useState<PracticeRunStats[]>([]);
  const [currentRun, setCurrentRun] = useState<number>(1);
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
      fetchPracticeRuns();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();

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

  const fetchPracticeRuns = async () => {
    try {
      const res = await fetch("/api/practice/runs");
      const data = await res.json();

      if (res.ok) {
        setPracticeRuns(data.runs || []);
        setCurrentRun(data.currentRun || 1);
      }
    } catch (err) {
      console.error("Error fetching practice runs:", err);
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

      <div className="bg-[#202020] border border-white/10 rounded-lg p-6 mb-8">
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

      {/* Practice Runs Section */}
      {practiceRuns.length > 0 && (
        <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#f5f5f5]">
              Practice Runs
            </h2>
            <span className="text-sm text-[#b4b4b4]">
              Currently on Run #{currentRun}
            </span>
          </div>

          <div className="space-y-3">
            {practiceRuns.map((run) => {
              const accuracy = run.total_attempts > 0
                ? Math.round((run.first_try_solves / run.solved_puzzles) * 100) || 0
                : 0;
              const progress = run.total_puzzles > 0
                ? Math.round((run.solved_puzzles / run.total_puzzles) * 100)
                : 0;

              return (
                <div
                  key={run.practice_run}
                  className={`p-4 rounded-lg border ${
                    run.practice_run === currentRun
                      ? "bg-[#f44336]/10 border-[#f44336]/30"
                      : "bg-[#3c3c3c]/30 border-white/5"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Run number and status */}
                    <div className="flex items-center gap-3 sm:w-32">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
                        run.is_complete
                          ? "bg-[#18be5d]/20 text-[#18be5d]"
                          : run.practice_run === currentRun
                          ? "bg-[#f44336]/20 text-[#f44336]"
                          : "bg-[#3c3c3c] text-[#b4b4b4]"
                      }`}>
                        {run.practice_run}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#f5f5f5]">
                          Run #{run.practice_run}
                        </p>
                        <p className="text-xs text-[#b4b4b4]">
                          {run.is_complete ? "Completed" : run.practice_run === currentRun ? "In Progress" : "Incomplete"}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#b4b4b4]">
                          {run.solved_puzzles} / {run.total_puzzles} puzzles
                        </span>
                        <span className={run.is_complete ? "text-[#18be5d]" : "text-[#b4b4b4]"}>
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2 bg-[#3c3c3c] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            run.is_complete ? "bg-[#18be5d]" : "bg-[#8a2be2]"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 sm:gap-6 text-center sm:text-right">
                      <div>
                        <p className="text-lg font-semibold text-[#f5f5f5]">
                          {run.first_try_solves}
                        </p>
                        <p className="text-xs text-[#b4b4b4]">1st try</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-[#3b82f6]">
                          {accuracy}%
                        </p>
                        <p className="text-xs text-[#b4b4b4]">accuracy</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-[#b4b4b4]">
                          {run.total_attempts}
                        </p>
                        <p className="text-xs text-[#b4b4b4]">attempts</p>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  {run.started_at && (
                    <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-4 text-xs text-[#b4b4b4]">
                      <span>
                        Started: {new Date(run.started_at).toLocaleDateString()}
                      </span>
                      {run.completed_at && (
                        <span>
                          Completed: {new Date(run.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {practiceRuns.length === 0 && (
            <p className="text-[#b4b4b4] text-center py-8">
              No practice runs yet. Start practicing to see your progress here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
