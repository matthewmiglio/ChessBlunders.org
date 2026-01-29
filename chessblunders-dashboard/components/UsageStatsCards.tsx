"use client";

import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";

interface UsageSummary {
  total_game_users: number;
  total_games: number;
  avg_games_per_user: number;
  total_analysis_users: number;
  total_analyses: number;
  avg_analyses_per_user: number;
  total_practice_users: number;
  total_blunders_practiced: number;
  avg_blunders_per_user: number;
}

export function UsageStatsCards() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/summary");
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="Games per User"
        value={data?.avg_games_per_user?.toLocaleString() || "0"}
        subtitle={`${data?.total_games?.toLocaleString() || 0} total games from ${data?.total_game_users?.toLocaleString() || 0} users`}
        color="sky"
      />
      <StatCard
        title="Analyses per User"
        value={data?.avg_analyses_per_user?.toLocaleString() || "0"}
        subtitle={`${data?.total_analyses?.toLocaleString() || 0} total analyses from ${data?.total_analysis_users?.toLocaleString() || 0} users`}
        color="emerald"
      />
      <StatCard
        title="Blunders Practiced per User"
        value={data?.avg_blunders_per_user?.toLocaleString() || "0"}
        subtitle={`${data?.total_blunders_practiced?.toLocaleString() || 0} blunders practiced by ${data?.total_practice_users?.toLocaleString() || 0} users`}
        color="violet"
      />
    </div>
  );
}
