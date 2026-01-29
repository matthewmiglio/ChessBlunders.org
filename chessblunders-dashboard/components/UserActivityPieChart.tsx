"use client";

import { useEffect, useState } from "react";

interface ActivityData {
  activity_bucket: string;
  user_count: number;
}

const BUCKET_ORDER = ["Last 24 hours", "Last 7 days", "7+ days ago"];
const BUCKET_COLORS: Record<string, string> = {
  "Last 24 hours": "#10b981",  // emerald - most active
  "Last 7 days": "#0ea5e9",    // sky - moderately active
  "7+ days ago": "#6b7280",    // gray - inactive
};

export function UserActivityPieChart() {
  const [data, setData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/user-activity");
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];
      // Sort by bucket order
      const sorted = arr.sort((a: ActivityData, b: ActivityData) =>
        BUCKET_ORDER.indexOf(a.activity_bucket) - BUCKET_ORDER.indexOf(b.activity_bucket)
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-sm font-bold text-gray-100 mb-4">User Activity</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.user_count, 0);

  // Calculate pie chart segments
  let cumulativePercent = 0;
  const segments = data.map((d) => {
    const percent = (d.user_count / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...d,
      percent,
      startPercent,
      endPercent: cumulativePercent,
    };
  });

  const size = 160;
  const center = size / 2;
  const radius = 60;

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", cx, cy,
      "L", start.x, start.y,
      "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">User Activity (by Practice)</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} users</span>
      </div>
      <div className="flex items-center gap-6">
        {/* Pie Chart */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, i) => {
            const startAngle = (seg.startPercent / 100) * 360;
            const endAngle = (seg.endPercent / 100) * 360;
            if (seg.percent >= 99.9) {
              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill={BUCKET_COLORS[seg.activity_bucket] || "#6b7280"}
                />
              );
            }
            if (seg.percent < 0.1) return null;
            return (
              <path
                key={i}
                d={describeArc(center, center, radius, startAngle, endAngle)}
                fill={BUCKET_COLORS[seg.activity_bucket] || "#6b7280"}
                className="hover:opacity-80 transition-opacity"
              >
                <title>{`${seg.activity_bucket}: ${seg.user_count.toLocaleString()} (${seg.percent.toFixed(1)}%)`}</title>
              </path>
            );
          })}
          <circle cx={center} cy={center} r={35} fill="#111827" />
        </svg>
        {/* Legend */}
        <div className="flex flex-col gap-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: BUCKET_COLORS[seg.activity_bucket] || "#6b7280" }}
              />
              <span className="text-sm text-gray-300">
                {seg.activity_bucket}
              </span>
              <span className="text-sm text-gray-500">
                {seg.user_count.toLocaleString()} ({seg.percent.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
