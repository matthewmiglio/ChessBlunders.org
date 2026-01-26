"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const CATEGORIES = [
  { id: "feature", label: "Feature Request" },
  { id: "bug", label: "Bug Report" },
  { id: "ux", label: "UX/UI" },
  { id: "puzzles", label: "Puzzles" },
  { id: "other", label: "Other" },
];

const MAX_TEXT_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;

export function FeedbackForm() {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("feature");
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canSubmit = user && name.trim().length > 0 && text.trim().length > 0 && text.length <= MAX_TEXT_LENGTH && name.length <= MAX_NAME_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), text: text.trim(), category, stars }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setMessage({ type: "success", text: "Thank you for your feedback!" });
      setName("");
      setText("");
      setCategory("feature");
      setStars(0);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to submit feedback" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
        <p className="text-[#b4b4b4]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6 relative">
      <h1 className="text-xl font-semibold text-[#f5f5f5] mb-2">Submit Feedback</h1>
      <p className="text-[#b4b4b4] text-sm mb-6">
        Help us improve ChessBlunders by sharing your thoughts, reporting bugs, or requesting features.
      </p>

      {/* Not logged in overlay */}
      {!user && (
        <div className="absolute inset-0 bg-[#202020]/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center z-10">
          <p className="text-[#f5f5f5] text-lg font-medium mb-4">Sign in to submit feedback</p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-6 py-2.5 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all"
          >
            Sign In
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className={!user ? "blur-sm pointer-events-none" : ""}>
        {/* Name field */}
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-[#b4b4b4] mb-2">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How should we call you?"
            maxLength={MAX_NAME_LENGTH}
            className="w-full px-4 py-2.5 bg-[#3c3c3c] border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#f44336]/50 focus:border-transparent transition-all"
          />
          <p className="text-xs text-[#8c8c8c] mt-1">
            {name.length}/{MAX_NAME_LENGTH}
          </p>
        </div>

        {/* Category selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#b4b4b4] mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  category === cat.id
                    ? "bg-[#f44336] text-white"
                    : "bg-[#3c3c3c] text-[#b4b4b4] hover:bg-[#3c3c3c]/80 border border-white/10"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Star rating */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#b4b4b4] mb-2">
            Rating <span className="text-[#8c8c8c]">(optional)</span>
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStars(star === stars ? 0 : star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                className="text-2xl transition-transform hover:scale-110"
              >
                {star <= (hoveredStar || stars) ? (
                  <span className="text-yellow-400">&#9733;</span>
                ) : (
                  <span className="text-[#3c3c3c]">&#9733;</span>
                )}
              </button>
            ))}
            {stars > 0 && (
              <button
                type="button"
                onClick={() => setStars(0)}
                className="ml-2 text-xs text-[#8c8c8c] hover:text-[#b4b4b4] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Message textarea */}
        <div className="mb-6">
          <label htmlFor="text" className="block text-sm font-medium text-[#b4b4b4] mb-2">
            Your Feedback
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell us what's on your mind..."
            rows={5}
            maxLength={MAX_TEXT_LENGTH + 100}
            className="w-full px-4 py-2.5 bg-[#3c3c3c] border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#8c8c8c] focus:outline-none focus:ring-2 focus:ring-[#f44336]/50 focus:border-transparent transition-all resize-none"
          />
          <p className={`text-xs mt-1 ${text.length > MAX_TEXT_LENGTH ? "text-[#f44336]" : "text-[#8c8c8c]"}`}>
            {text.length}/{MAX_TEXT_LENGTH}
          </p>
        </div>

        {/* Message display */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-md ${
              message.type === "success"
                ? "bg-[#18be5d]/10 border border-[#18be5d]/30 text-[#18be5d]"
                : "bg-[#f44336]/10 border border-[#f44336]/30 text-[#f44336]"
            }`}
          >
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full inline-flex items-center justify-center rounded-md bg-[#f44336] px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#f44336]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f44336] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>
    </div>
  );
}
