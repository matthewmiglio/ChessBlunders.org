"use client";

import { useEffect, useState } from "react";

interface DailyData {
  day: string;
  analysis_count: number;
}

function formatDateEST(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

export function AnalysesOverTimeChart() {
  const [data, setData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/analyses-daily");
      const json = await res.json();
      setData(json);
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
        <h3 className="text-sm font-bold text-gray-100 mb-4">Analyses Over Time</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.analysis_count), 1);
  const total = data.reduce((sum, d) => sum + d.analysis_count, 0);
  const chartHeight = 200;
  const chartWidth = 600;

  // Generate Y-axis labels (5 labels from 0 to max)
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) =>
    Math.round((maxCount * (yAxisSteps - 1 - i)) / (yAxisSteps - 1))
  );

  // Generate X-axis labels (show ~5-7 labels evenly spaced)
  const xLabelCount = Math.min(data.length, 7);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i * (data.length - 1)) / (xLabelCount - 1))
  );

  // Generate SVG path for line
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = chartHeight - (d.analysis_count / maxCount) * chartHeight;
    return { x, y, data: d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-100">Analyses Over Time</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
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
        <div className="flex-1 relative" style={{ height: `${chartHeight}px` }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {yAxisLabels.map((_, i) => {
              const y = (i / (yAxisSteps - 1)) * chartHeight;
              return (
                <line
                  key={i}
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#374151"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}
            {/* Area fill */}
            <path d={areaPath} fill="rgba(16, 185, 129, 0.1)" />
            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Data points */}
            {points.map((p, i) => (
              <g key={i} className="group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#10b981"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ vectorEffect: "non-scaling-stroke" }}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="12"
                  fill="transparent"
                  className="cursor-pointer"
                />
                <title>{`${formatDateEST(p.data.day)}: ${p.data.analysis_count} analyses`}</title>
              </g>
            ))}
          </svg>
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex mt-2" style={{ marginLeft: "40px" }}>
        <div className="flex-1 flex justify-between">
          {xLabelIndices.map((idx) => (
            <span key={idx} className="text-xs text-gray-500">
              {formatDateEST(data[idx].day)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
