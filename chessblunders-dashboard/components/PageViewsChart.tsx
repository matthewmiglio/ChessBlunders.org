"use client";

import { useEffect, useState } from "react";

interface DailyData {
  day: string;
  views: number;
}

export function PageViewsChart({ days }: { days: number }) {
  const [data, setData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch(`/api/analytics/daily?days=${days}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-gray-800 rounded"></div>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const total = data.reduce((sum, d) => sum + d.views, 0);

  // Calculate Y-axis labels (0, 25%, 50%, 75%, 100% of max)
  const yAxisLabels = [maxViews, Math.round(maxViews * 0.75), Math.round(maxViews * 0.5), Math.round(maxViews * 0.25), 0];
  const chartHeight = 200;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">Daily Page Views</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
      </div>
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-3 text-right" style={{ height: `${chartHeight}px` }}>
          {yAxisLabels.map((label, i) => (
            <span key={i} className="text-xs text-gray-500 leading-none">
              {label}
            </span>
          ))}
        </div>
        {/* Chart area */}
        <div className="flex-1 flex items-end gap-1" style={{ height: `${chartHeight}px` }}>
          {data.map((point, i) => {
            const barHeight = (point.views / maxViews) * chartHeight;
            const date = new Date(point.day);
            const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full group"
              >
                <div className="relative w-full flex items-end justify-center h-full">
                  <div
                    className="w-full bg-sky-500 rounded-t hover:bg-sky-400 transition-colors"
                    style={{ height: `${Math.max(barHeight, 4)}px` }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {point.views} views
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex mt-2" style={{ marginLeft: "40px" }}>
        {data.length <= 14 ? (
          <div className="flex-1 flex gap-1">
            {data.map((point, i) => {
              const date = new Date(point.day);
              const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <span key={i} className="flex-1 text-xs text-gray-500 text-center truncate">
                  {label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex justify-between">
            <span className="text-xs text-gray-500">
              {new Date(data[0]?.day).toLocaleDateString()}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(data[data.length - 1]?.day).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
