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

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">Daily Page Views</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
      </div>
      <div className="flex items-end gap-1" style={{ height: "200px" }}>
        {data.map((point, i) => {
          const heightPercent = (point.views / maxViews) * 100;
          const date = new Date(point.day);
          const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full group"
            >
              <div className="relative w-full">
                <div
                  className="w-full bg-sky-500 rounded-t hover:bg-sky-400 transition-colors"
                  style={{ height: `${Math.max(heightPercent, 2)}%`, minHeight: "4px" }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {point.views} views
                </div>
              </div>
              {data.length <= 14 && (
                <span className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {data.length > 14 && (
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">
            {new Date(data[0]?.day).toLocaleDateString()}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(data[data.length - 1]?.day).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}
