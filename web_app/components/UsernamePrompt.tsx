"use client";

import { useState } from "react";

interface UsernamePromptProps {
  onSubmit: (username: string) => Promise<void>;
}

export function UsernamePrompt({ onSubmit }: UsernamePromptProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError("");

    try {
      await onSubmit(username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set username");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#202020] border border-white/10 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="w-12 h-12 rounded-md bg-[#f44336]/20 flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-[#f44336]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-[#f5f5f5] mb-2">
          Set Your Chess.com Username
        </h2>
        <p className="text-[#b4b4b4] text-sm mb-6 leading-relaxed">
          Enter your Chess.com username to import your games and start training
          on your blunders.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your Chess.com username"
            className="w-full px-4 py-3 bg-[#3c3c3c]/30 border border-white/10 rounded-md text-[#f5f5f5] placeholder-[#b4b4b4] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all mb-3"
            disabled={loading}
          />

          {error && (
            <p className="text-[#f44336] text-sm mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-4 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#202020] border-t-transparent rounded-full animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
