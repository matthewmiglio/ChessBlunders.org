"use client";

import { useEffect, useState } from "react";

interface ResultData {
  result: string;
  count: number;
}

const RESULT_COLORS: Record<string, string> = {
  win: "#10b981",      // emerald
  loss: "#ef4444",     // red
  draw: "#6b7280",     // gray
};

const RESULT_LABELS: Record<string, string> = {
  win: "Wins",
  loss: "Losses",
  draw: "Draws",
};

// Map raw results to win/loss/draw categories
function categorizeResult(result: string): "win" | "loss" | "draw" {
  const lowerResult = result.toLowerCase();
  if (lowerResult === "win") return "win";
  if (["stalemate", "repetition", "timevsinsufficient", "agreed", "insufficient", "50move"].includes(lowerResult)) {
    return "draw";
  }
  // Everything else is a loss: resigned, checkmated, timeout, abandoned, etc.
  return "loss";
}

export function GameResultsPieChart() {
  const [data, setData] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/usage/game-results");
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
        <h3 className="text-sm font-bold text-gray-100 mb-4">Game Results</h3>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  // Aggregate raw results into win/loss/draw categories
  const aggregated: Record<string, number> = { win: 0, loss: 0, draw: 0 };
  for (const d of data) {
    const category = categorizeResult(d.result);
    aggregated[category] += d.count;
  }

  // Convert to array in consistent order: win, loss, draw
  const aggregatedData = [
    { result: "win", count: aggregated.win },
    { result: "loss", count: aggregated.loss },
    { result: "draw", count: aggregated.draw },
  ].filter(d => d.count > 0);

  const total = aggregatedData.reduce((sum, d) => sum + d.count, 0);

  // Calculate pie chart segments
  let cumulativePercent = 0;
  const segments = aggregatedData.map((d) => {
    const percent = (d.count / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...d,
      percent,
      startPercent,
      endPercent: cumulativePercent,
    };
  });

  // Create SVG pie chart using conic gradient simulation with path arcs
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
        <h3 className="text-sm font-bold text-gray-100">Game Results</h3>
        <span className="text-sm text-gray-400">{total.toLocaleString()} games</span>
      </div>
      <div className="flex items-center gap-6">
        {/* Pie Chart */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, i) => {
            const startAngle = (seg.startPercent / 100) * 360;
            const endAngle = (seg.endPercent / 100) * 360;
            // Handle full circle case
            if (seg.percent >= 99.9) {
              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill={RESULT_COLORS[seg.result] || "#6b7280"}
                />
              );
            }
            return (
              <path
                key={i}
                d={describeArc(center, center, radius, startAngle, endAngle)}
                fill={RESULT_COLORS[seg.result] || "#6b7280"}
                className="hover:opacity-80 transition-opacity"
              >
                <title>{`${RESULT_LABELS[seg.result] || seg.result}: ${seg.count.toLocaleString()} (${seg.percent.toFixed(1)}%)`}</title>
              </path>
            );
          })}
          {/* Center hole for donut effect */}
          <circle cx={center} cy={center} r={35} fill="#111827" />
        </svg>
        {/* Legend */}
        <div className="flex flex-col gap-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: RESULT_COLORS[seg.result] || "#6b7280" }}
              />
              <span className="text-sm text-gray-300">
                {RESULT_LABELS[seg.result] || seg.result}
              </span>
              <span className="text-sm text-gray-500">
                {seg.percent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
