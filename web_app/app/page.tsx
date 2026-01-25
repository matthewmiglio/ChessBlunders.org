"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { UsernamePrompt } from "@/components/UsernamePrompt";

export default function Home() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  useEffect(() => {
    if (user && profile && !profile.chess_username) {
      setShowUsernamePrompt(true);
    }
  }, [user, profile]);

  const handleSetUsername = async (username: string) => {
    const response = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chessUsername: username }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to set username");
    }

    await refreshProfile();
    setShowUsernamePrompt(false);
    router.push("/games");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <>
      {showUsernamePrompt && (
        <UsernamePrompt onSubmit={handleSetUsername} />
      )}

      <div className="text-center py-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          ChessBlunders.org
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Learn from your chess mistakes
        </p>

        {user ? (
          <div className="space-y-4">
            <p className="text-gray-700">
              Welcome back, {profile?.chess_username || user.email}!
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push("/games")}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium"
              >
                View Games
              </button>
              <button
                onClick={() => router.push("/practice")}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-medium"
              >
                Practice Blunders
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">1. Import Games</h3>
                <p className="text-gray-600">
                  Connect your Chess.com account and import your recent games.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">2. Analyze</h3>
                <p className="text-gray-600">
                  Our engine finds the blunders in your games automatically.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">3. Train</h3>
                <p className="text-gray-600">
                  Practice solving your own blunder positions to improve.
                </p>
              </div>
            </div>
            <p className="text-gray-600">
              Create an account to get started.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
