"use client";

import { useState, useEffect } from "react";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";
import { PageViewsChart } from "@/components/PageViewsChart";
import { TopPagesChart } from "@/components/TopPagesChart";
import { TopCountriesChart } from "@/components/TopCountriesChart";
import { SubscriptionStats } from "@/components/SubscriptionStats";
import { FeedbackList } from "@/components/FeedbackList";
import { PeriodComparison } from "@/components/PeriodComparison";

interface Summary {
  total_views: number;
  unique_visitors: number;
  unique_sessions: number;
  top_page: string;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      const res = await fetch("/api/analytics/summary");
      const data = await res.json();
      setSummary(data);
      setLoading(false);
    }
    fetchSummary();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-white">ChessBlunders Analytics</h1>
          <p className="text-sm text-gray-400">All-time statistics</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Period Comparison */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Recent Trends</h2>
          <PeriodComparison />
        </section>

        {/* Summary Stats */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Total Page Views"
                  value={summary?.total_views?.toLocaleString() || "0"}
                  subtitle="All time"
                  color="sky"
                />
                <StatCard
                  title="Unique Visitors"
                  value={summary?.unique_visitors?.toLocaleString() || "0"}
                  subtitle="By visitor ID"
                  color="emerald"
                />
                <StatCard
                  title="Sessions"
                  value={summary?.unique_sessions?.toLocaleString() || "0"}
                  subtitle="Unique sessions"
                  color="violet"
                />
                <StatCard
                  title="Top Page"
                  value={summary?.top_page || "-"}
                  subtitle="Most visited"
                  color="amber"
                />
              </>
            )}
          </div>
        </section>

        {/* Page Views Chart */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Traffic Over Time</h2>
          <PageViewsChart />
        </section>

        {/* Bottom Charts */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Breakdown</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopPagesChart />
            <TopCountriesChart />
          </div>
        </section>

        {/* Subscription & Revenue Stats */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            Subscriptions & Revenue
          </h2>
          <SubscriptionStats />
        </section>

        {/* User Feedback */}
        <section>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">
            User Feedback
          </h2>
          <FeedbackList />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-500">
          ChessBlunders.org Analytics Dashboard
        </div>
      </footer>
    </div>
  );
}
