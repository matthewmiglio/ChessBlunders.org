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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Set Your Chess.com Username
        </h2>
        <p className="text-gray-600 mb-4">
          Enter your Chess.com username to import your games and start training
          on your blunders.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your Chess.com username"
            className="w-full px-4 py-2 border border-gray-300 rounded mb-2 text-gray-900"
            disabled={loading}
          />

          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white py-2 rounded font-medium"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
