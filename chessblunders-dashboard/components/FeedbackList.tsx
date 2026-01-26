"use client";

import { useState, useEffect } from "react";

interface FeedbackItem {
  id: string;
  name: string;
  text: string;
  stars: number;
  category: string;
  created_at: string;
}

export function FeedbackList() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeedback() {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      setFeedback(data.feedback || []);
      setLoading(false);
    }
    fetchFeedback();
  }, []);

  const categoryColors: Record<string, string> = {
    bug: "bg-red-500/20 text-red-400",
    feature: "bg-blue-500/20 text-blue-400",
    ux: "bg-purple-500/20 text-purple-400",
    puzzles: "bg-green-500/20 text-green-400",
    other: "bg-gray-500/20 text-gray-400",
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400">Loading feedback...</p>
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400">No feedback yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="divide-y divide-gray-700">
        {feedback.map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-700/30">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[item.category] || categoryColors.other}`}>
                  {item.category}
                </span>
                {item.stars > 0 && (
                  <span className="text-yellow-400 text-sm">
                    {Array(item.stars).fill(null).map((_, i) => <span key={i}>&#9733;</span>)}
                    {Array(5 - item.stars).fill(null).map((_, i) => <span key={i} className="text-gray-600">&#9733;</span>)}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Name */}
            <p className="text-sm text-gray-400 mb-2">{item.name}</p>

            {/* Message */}
            <p className="text-gray-200 whitespace-pre-wrap">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
