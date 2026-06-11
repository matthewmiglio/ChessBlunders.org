"use client";

import { useState, useEffect } from "react";
import { StatCard, StatCardSkeleton } from "./StatCard";

interface ChessBlundersStats {
  users: {
    total: number;
    everSubscribed: number;
    activeSubscribers: number;
    cancelingSoon: number;
    canceled: number;
    healthySubscribers: number;
    subscriptionRate: string;
    churnRate: string;
  };
  revenue: {
    total: string;
    thisMonth: string;
    lastMonth: string;
    mrr: string;
    arpu: string;
  };
}

export function SubscriptionStats() {
  const [stats, setStats] = useState<ChessBlundersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/stats/chessblunders");
        if (!res.ok) {
          throw new Error("Failed to fetch subscription stats");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-red-400">
        <p className="font-medium">Failed to load subscription stats</p>
        <p className="text-sm text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <div>
        <h3 className="text-md font-medium text-gray-300 mb-3">
          User Metrics
        </h3>
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
                title="Total Users"
                value={stats?.users.total.toLocaleString() || "0"}
                subtitle="Registered accounts"
                color="sky"
              />
              <StatCard
                title="Active Subscribers"
                value={stats?.users.activeSubscribers.toLocaleString() || "0"}
                subtitle={`${stats?.users.subscriptionRate || 0}% of users`}
                color="emerald"
              />
              <StatCard
                title="Canceling Soon"
                value={stats?.users.cancelingSoon.toLocaleString() || "0"}
                subtitle="Active but will cancel"
                color="amber"
              />
              <StatCard
                title="Churned"
                value={stats?.users.canceled.toLocaleString() || "0"}
                subtitle={`${stats?.users.churnRate || 0}% churn rate`}
                color="violet"
              />
            </>
          )}
        </div>
      </div>

      {/* Revenue Stats */}
      <div>
        <h3 className="text-md font-medium text-gray-300 mb-3">
          Revenue Metrics
        </h3>
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
                title="Total Revenue"
                value={`$${stats?.revenue.total || "0"}`}
                subtitle="All time"
                color="emerald"
              />
              <StatCard
                title="This Month"
                value={`$${stats?.revenue.thisMonth || "0"}`}
                subtitle="Current period"
                color="sky"
              />
              <StatCard
                title="Last Month"
                value={`$${stats?.revenue.lastMonth || "0"}`}
                subtitle="Previous period"
                color="violet"
              />
              <StatCard
                title="MRR"
                value={`$${stats?.revenue.mrr || "0"}`}
                subtitle="Monthly recurring"
                color="amber"
              />
            </>
          )}
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-md font-medium text-gray-300">Detailed Breakdown</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {loading ? (
            <div className="p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-gray-700 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-700 rounded w-1/3"></div>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Total Users</span>
                <span className="text-gray-100 font-medium">
                  {stats?.users.total.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Ever Subscribed</span>
                <span className="text-gray-100 font-medium">
                  {stats?.users.everSubscribed.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Currently Active</span>
                <span className="text-emerald-400 font-medium">
                  {stats?.users.activeSubscribers.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Healthy Subscribers</span>
                <span className="text-emerald-400 font-medium">
                  {stats?.users.healthySubscribers.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Canceling Soon</span>
                <span className="text-amber-400 font-medium">
                  {stats?.users.cancelingSoon.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Fully Canceled</span>
                <span className="text-violet-400 font-medium">
                  {stats?.users.canceled.toLocaleString()}
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between border-t border-gray-700">
                <span className="text-gray-400">Subscription Rate</span>
                <span className="text-gray-100 font-medium">
                  {stats?.users.subscriptionRate}%
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between">
                <span className="text-gray-400">Churn Rate</span>
                <span className="text-gray-100 font-medium">
                  {stats?.users.churnRate}%
                </span>
              </div>
              <div className="px-6 py-3 flex justify-between border-t border-gray-700">
                <span className="text-gray-400">ARPU (Avg Revenue Per User)</span>
                <span className="text-gray-100 font-medium">
                  ${stats?.revenue.arpu}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
