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
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showUsernamePrompt && (
        <UsernamePrompt onSubmit={handleSetUsername} />
      )}

      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
        </div>

        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Stockfish 16
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white mb-6 leading-[1.1]">
              See exactly where your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">chess games go wrong.</span>
            </h1>

            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Powerful Stockfish analysis shows every blunder. Practice mode turns them into puzzles.
            </p>

            {user ? (
              <div className="space-y-4">
                <p className="text-slate-300">
                  Welcome back, <span className="text-sky-400 font-medium">{profile?.chess_username || user.email}</span>
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={() => router.push("/games")}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-all"
                  >
                    View Games
                  </button>
                  <button
                    onClick={() => router.push("/practice")}
                    className="inline-flex items-center justify-center rounded-full bg-white/5 border border-white/10 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-all"
                  >
                    Practice
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/signin")}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-all"
              >
                Analyze My Games
              </button>
            )}
          </div>

          {/* App Preview Card */}
          <div className="relative max-w-4xl mx-auto">
            {/* Glow effect behind card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-sky-500/20 via-violet-500/20 to-sky-500/20 rounded-3xl blur-2xl opacity-50" />

            <div className="relative bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-slate-800/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-slate-500 text-xs">chessblunders.org/analysis</span>
                </div>
              </div>

              {/* App content mock */}
              <div className="p-6 grid md:grid-cols-2 gap-6">
                {/* Left: Game list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Recent Games</h3>
                    <span className="text-xs text-sky-400">View All</span>
                  </div>
                  {[
                    { opponent: "Magnus2024", result: "Lost", blunders: 3, avatar: "/profile_icons/Magnus_Carlsen_in_2025.webp" },
                    { opponent: "ChessKing99", result: "Won", blunders: 1, avatar: "/profile_icons/hikaru.webp" },
                    { opponent: "Speedster", result: "Lost", blunders: 4, avatar: "/profile_icons/igorpic.webp" },
                  ].map((game, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                      <img
                        src={game.avatar}
                        alt={game.opponent}
                        className="w-8 h-8 rounded-lg object-cover border border-white/10"
                      />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">vs {game.opponent}</p>
                        <p className="text-slate-500 text-xs">{game.result}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${game.blunders > 2 ? "text-red-400" : "text-amber-400"}`}>
                          {game.blunders} blunders
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: Blunder preview */}
                <div className="bg-slate-800/30 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Blunder Analysis</h3>
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">-3.2</span>
                  </div>
                  {/* Chess board image */}
                  <img
                    src="/hero.png"
                    alt="Chess position"
                    className="w-full rounded-lg border border-white/10 mb-4"
                  />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-400">your move:</span>
                      <span className="text-white font-mono">Q moves to F4</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-400">best move:</span>
                      <span className="text-white font-mono">knight to E2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
