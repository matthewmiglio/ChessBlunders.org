"use client";

import { useEffect, useState } from "react";

interface BlunderData {
  blunder_count: number;
  analysis_count: number;
}

export function BlunderCountDistribution() {
  const [data, setData] = useState<BlunderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/blunder-distribution");
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
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
        <h3 className="text-sm font-bold text-gray-100 mb-4">Blunders per Game</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.analysis_count), 1);
  const total = data.reduce((sum, d) => sum + d.analysis_count, 0);
  const chartHeight = 200;

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) =>
    Math.round((maxCount * (yAxisSteps - 1 - i)) / (yAxisSteps - 1))
  );

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">Blunders per Game Distribution</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} analyses</span>
      </div>
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-3 text-right" style={{ height: `${chartHeight}px` }}>
          {yAxisLabels.map((label, i) => (
            <span key={i} className="text-xs text-gray-500 leading-none">
              {label.toLocaleString()}
            </span>
          ))}
        </div>
        {/* Chart area */}
        <div className="flex-1 flex items-end gap-1" style={{ height: `${chartHeight}px` }}>
          {data.map((point, i) => {
            const barHeight = (point.analysis_count / maxCount) * chartHeight;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                <div className="relative w-full flex items-end justify-center h-full">
                  <div
                    className="w-full bg-amber-500 rounded-t hover:bg-amber-400 transition-colors"
                    style={{ height: `${Math.max(barHeight, 4)}px` }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {point.analysis_count.toLocaleString()} games with {point.blunder_count} blunders
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex mt-2" style={{ marginLeft: "40px" }}>
        <div className="flex-1 flex gap-1">
          {data.map((point, i) => (
            <span key={i} className="flex-1 text-xs text-gray-500 text-center">
              {point.blunder_count}
            </span>
          ))}
        </div>
      </div>
      <div className="text-center mt-1">
        <span className="text-xs text-gray-600">Blunders per Game</span>
      </div>
    </div>
  );
}
