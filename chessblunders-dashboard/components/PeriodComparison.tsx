"use client";

import { useEffect, useState } from "react";

interface PeriodData {
  period: string;
  unique_visitors: number;
  total_pageviews: number;
}

export function PeriodComparison() {
  const [data, setData] = useState<PeriodData[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/comparison")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <PeriodComparisonSkeleton />;
  }

  if (!data || data.length < 2) {
    return null;
  }

  const current = data.find((d) => d.period === "current");
  const previous = data.find((d) => d.period === "previous");

  if (!current || !previous) return null;

  const visitorChange =
    previous.unique_visitors > 0
      ? ((current.unique_visitors - previous.unique_visitors) /
          previous.unique_visitors) *
        100
      : 0;

  const pageviewChange =
    previous.total_pageviews > 0
      ? ((current.total_pageviews - previous.total_pageviews) /
          previous.total_pageviews) *
        100
      : 0;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-sm font-bold text-gray-100 mb-1">10-Day Comparison</h3>
      <p className="text-gray-500 text-xs mb-5">Last 10 days vs previous 10 days</p>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-gray-400 text-xs mb-2">Unique Visitors</p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">
              {current.unique_visitors.toLocaleString()}
            </span>
            <ChangeIndicator value={visitorChange} />
          </div>
          <p className="text-gray-500 text-xs mt-1">
            vs {previous.unique_visitors.toLocaleString()} previous
          </p>
        </div>

        <div>
          <p className="text-gray-400 text-xs mb-2">Page Views</p>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">
              {current.total_pageviews.toLocaleString()}
            </span>
            <ChangeIndicator value={pageviewChange} />
          </div>
          <p className="text-gray-500 text-xs mt-1">
            vs {previous.total_pageviews.toLocaleString()} previous
          </p>
        </div>
      </div>
    </div>
  );
}

function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive
    ? "text-green-400"
    : isNegative
    ? "text-red-400"
    : "text-gray-400";
  const arrow = isPositive ? "^" : isNegative ? "v" : "";

  return (
    <span className={`text-sm font-medium ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function PeriodComparisonSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-1" />
      <div className="h-3 w-48 bg-gray-800 rounded animate-pulse mb-5" />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="h-3 w-20 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-8 w-28 bg-gray-800 rounded animate-pulse" />
        </div>
        <div>
          <div className="h-3 w-20 bg-gray-800 rounded animate-pulse mb-2" />
          <div className="h-8 w-28 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
