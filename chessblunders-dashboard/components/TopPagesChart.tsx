"use client";

import { useEffect, useState } from "react";

interface PageData {
  path: string;
  views: number;
}

const PATH_LABELS: Record<string, string> = {
  "/": "Home",
  "/games": "Games",
  "/practice": "Practice",
  "/analysis": "Analysis",
  "/auth/signin": "Sign In",
};

export function TopPagesChart({ days }: { days: number }) {
  const [data, setData] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch(`/api/analytics/pages?days=${days}`);
      const json = await res.json();
      setData(json.slice(0, 10));
      setLoading(false);
    }
    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((p) => p.views), 1);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-sm font-bold text-gray-100 mb-4">Top Pages</h3>
      <div className="space-y-3">
        {data.map((page) => (
          <div key={page.path} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-24 truncate" title={page.path}>
              {PATH_LABELS[page.path] || page.path}
            </span>
            <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded"
                style={{ width: `${(page.views / maxViews) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-400 w-12 text-right">
              {page.views.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
