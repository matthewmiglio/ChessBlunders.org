"use client";

import { useEffect, useState } from "react";

interface AttemptData {
  attempt_bucket: string;
  solve_count: number;
}

const BUCKET_ORDER = ["1st try", "2nd try", "3rd try", "4th+ tries"];

export function SolveAttemptsDistribution() {
  const [data, setData] = useState<AttemptData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/solve-attempts");
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];
      // Sort by bucket order
      const sorted = arr.sort((a: AttemptData, b: AttemptData) =>
        BUCKET_ORDER.indexOf(a.attempt_bucket) - BUCKET_ORDER.indexOf(b.attempt_bucket)
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Solve Attempts Distribution</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.solve_count), 1);
  const total = data.reduce((sum, d) => sum + d.solve_count, 0);
  const firstTryRate = data.find(d => d.attempt_bucket === "1st try")?.solve_count || 0;
  const firstTryPercent = total > 0 ? ((firstTryRate / total) * 100).toFixed(1) : "0";
  const chartHeight = 200;

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) =>
    Math.round((maxCount * (yAxisSteps - 1 - i)) / (yAxisSteps - 1))
  );

  const barColors = ["#1c5cab", "#7aa3d4", "#164a8a", "#9a7b0f"]; // paper/ink chart palette

  return (
    <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Solve Attempts Distribution</h3>
        <span className="text-sm text-gray-400">{firstTryPercent}% first-try solve rate</span>
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
        <div className="flex-1 flex items-end gap-4" style={{ height: `${chartHeight}px` }}>
          {data.map((point, i) => {
            const barHeight = (point.solve_count / maxCount) * chartHeight;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                <div className="relative w-full flex items-end justify-center h-full">
                  <div
                    className="w-full rounded-t hover:opacity-80 transition-opacity"
                    style={{
                      height: `${Math.max(barHeight, 4)}px`,
                      backgroundColor: barColors[i % barColors.length]
                    }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-100 text-gray-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {point.solve_count.toLocaleString()} solved on {point.attempt_bucket}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex mt-2" style={{ marginLeft: "40px" }}>
        <div className="flex-1 flex gap-4">
          {data.map((point, i) => (
            <span key={i} className="flex-1 text-xs text-gray-500 text-center">
              {point.attempt_bucket}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
