"use client";

import { useState, useEffect, useCallback } from "react";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";
import { PageViewsChart } from "@/components/PageViewsChart";
import { TopPagesChart } from "@/components/TopPagesChart";
import { TopCountriesChart } from "@/components/TopCountriesChart";
import { SubscriptionStats } from "@/components/SubscriptionStats";
import { FeedbackList } from "@/components/FeedbackList";
import { PeriodComparison } from "@/components/PeriodComparison";
import { UsageStatsCards } from "@/components/UsageStatsCards";
import { GamesOverTimeChart } from "@/components/GamesOverTimeChart";
import { AnalysesOverTimeChart } from "@/components/AnalysesOverTimeChart";
import { PracticeOverTimeChart } from "@/components/PracticeOverTimeChart";
import { GameResultsPieChart } from "@/components/GameResultsPieChart";
import { BlunderCountDistribution } from "@/components/BlunderCountDistribution";
import { SolveAttemptsDistribution } from "@/components/SolveAttemptsDistribution";
import { EngineUsageOverTime } from "@/components/EngineUsageOverTime";
import { UserActivityPieChart } from "@/components/UserActivityPieChart";
import { CumulativeUsersChart } from "@/components/CumulativeUsersChart";

interface Summary {
  total_views: number;
  unique_visitors: number;
  unique_sessions: number;
  top_page: string;
}

const sections = [
  { id: "trends", label: "Recent Trends" },
  { id: "overview", label: "Overview" },
  { id: "traffic", label: "Traffic" },
  { id: "breakdown", label: "Breakdown" },
  { id: "usage", label: "Usage Stats" },
  { id: "usage-time", label: "Usage Over Time" },
  { id: "games", label: "Game & Practice" },
  { id: "growth", label: "User Growth" },
  { id: "revenue", label: "Subscriptions & Revenue" },
  { id: "feedback", label: "Feedback" },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(sections[0].id);

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

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio);
        }
        let best = "";
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) { best = id; bestRatio = ratio; }
        }
        if (best && bestRatio > 0) setActiveTab(best);
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-6 pt-4 pb-2">
        <h1 className="text-xl font-bold text-gray-900">ChessBlunders Analytics</h1>
        <p className="text-sm text-gray-400">All-time statistics</p>
      </header>

      {/* Tab nav */}
      <nav className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-2 flex gap-2 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-sm text-sm transition-colors ${
                activeTab === s.id
                  ? "bg-gray-100 text-indigo-500 font-bold"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Period Comparison */}
        <section id="trends" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Recent Trends</h2>
          <PeriodComparison />
        </section>

        {/* Summary Stats */}
        <section id="overview" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Overview</h2>
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
                  color="indigo"
                />
                <StatCard
                  title="Unique Visitors"
                  value={summary?.unique_visitors?.toLocaleString() || "0"}
                  subtitle="By visitor ID"
                  color="green"
                />
                <StatCard
                  title="Sessions"
                  value={summary?.unique_sessions?.toLocaleString() || "0"}
                  subtitle="Unique sessions"
                  color="purple"
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
        <section id="traffic" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Traffic Over Time</h2>
          <PageViewsChart />
        </section>

        {/* Bottom Charts */}
        <section id="breakdown" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Breakdown</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopPagesChart />
            <TopCountriesChart />
          </div>
        </section>

        {/* Usage Statistics */}
        <section id="usage" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">
            Usage Statistics
          </h2>
          <UsageStatsCards />
        </section>

        {/* Usage Over Time Charts */}
        <section id="usage-time" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Usage Over Time</h2>
          <div className="space-y-6">
            <GamesOverTimeChart />
            <AnalysesOverTimeChart />
            <PracticeOverTimeChart />
            <EngineUsageOverTime />
          </div>
        </section>

        {/* Game & Practice Analytics */}
        <section id="games" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">Game & Practice Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GameResultsPieChart />
            <UserActivityPieChart />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <BlunderCountDistribution />
            <SolveAttemptsDistribution />
          </div>
        </section>

        {/* User Growth */}
        <section id="growth" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">User Growth</h2>
          <CumulativeUsersChart />
        </section>

        {/* Subscription & Revenue Stats */}
        <section id="revenue" className="mb-8 scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">
            Subscriptions & Revenue
          </h2>
          <SubscriptionStats />
        </section>

        {/* User Feedback */}
        <section id="feedback" className="scroll-mt-16">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-900 mb-4">
            User Feedback
          </h2>
          <FeedbackList />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-400">
          ChessBlunders.org Analytics Dashboard
        </div>
      </footer>
    </div>
  );
}
