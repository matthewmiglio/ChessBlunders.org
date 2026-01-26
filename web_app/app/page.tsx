"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#f44336] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#b4b4b4]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-[#141414] via-[#1a1a1a] to-[#141414]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f44336]/50 to-transparent" />
        </div>

        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#f44336]/10 border border-[#f44336]/20 text-[#f44336] text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Stockfish 16
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-[#f5f5f5] mb-6 leading-[1.1]">
              See exactly where your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f44336] to-[#ff6f00]">chess games go wrong.</span>
            </h1>

            <p className="text-lg text-[#b4b4b4] mb-8 max-w-xl mx-auto">
              Powerful Stockfish analysis shows every blunder. Practice mode turns them into puzzles.
            </p>

            {user ? (
              <div className="space-y-4 animate-slide-up">
                <p className="text-[#b4b4b4]">
                  Welcome back, <span className="text-[#f44336] font-medium">{profile?.chess_username || user.email}</span>
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={() => router.push("/games")}
                    className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-8 py-3.5 text-base font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
                  >
                    View Games
                  </button>
                  <button
                    onClick={() => router.push("/practice")}
                    className="inline-flex items-center justify-center rounded-md bg-[#3c3c3c] border border-white/10 px-8 py-3.5 text-base font-medium text-[#f5f5f5] hover:bg-[#3c3c3c]/80 transition-all"
                  >
                    Practice
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/signin")}
                className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-10 py-4 text-base font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
              >
                Analyze My Games
              </button>
            )}
          </div>

          {/* App Preview Card */}
          <div className="relative max-w-4xl mx-auto animate-slide-up">
            {/* Glow effect behind card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[#f44336]/20 via-[#8a2be2]/20 to-[#f44336]/20 rounded-xl blur-2xl opacity-50" />

            <div className="relative bg-[#202020] border border-white/10 rounded-lg overflow-hidden backdrop-blur-sm">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#1a1a1a]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#f44336]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#ffeb3b]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#18be5d]/80" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[#b4b4b4] text-xs">chessblunders.org/analysis</span>
                </div>
              </div>

              {/* App content mock */}
              <div className="p-6 grid md:grid-cols-2 gap-6">
                {/* Left: Game list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[#f5f5f5] font-semibold">Recent Games</h3>
                    <span className="text-xs text-[#f44336]">View All</span>
                  </div>
                  {[
                    { opponent: "Magnus2024", result: "Lost", blunders: 3, avatar: "/profile_icons/Magnus_Carlsen_in_2025.webp" },
                    { opponent: "HikaruFan99", result: "Won", blunders: 1, avatar: "/profile_icons/hikaru.webp" },
                    { opponent: "GothamGuru", result: "Lost", blunders: 4, avatar: "/profile_icons/gotham.webp" },
                    { opponent: "BotezGambit", result: "Won", blunders: 2, avatar: "/profile_icons/botez.webp" },
                    { opponent: "CramlingQueen", result: "Draw", blunders: 1, avatar: "/profile_icons/anna.webp" },
                    { opponent: "HansOnFire", result: "Lost", blunders: 5, avatar: "/profile_icons/hans.webp" },
                    { opponent: "SvidlerPro", result: "Won", blunders: 0, avatar: "/profile_icons/igorpic.webp" },
                  ].map((game, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[#3c3c3c]/50 rounded-lg border border-white/5">
                      <img
                        src={game.avatar}
                        alt={game.opponent}
                        className="w-8 h-8 rounded-md object-cover border border-white/10"
                      />
                      <div className="flex-1">
                        <p className="text-[#f5f5f5] text-sm font-medium">vs {game.opponent}</p>
                        <p className={`text-xs ${
                          game.result === "Won" ? "text-[#18be5d]" :
                          game.result === "Lost" ? "text-[#f44336]" :
                          "text-[#b4b4b4]"
                        }`}>{game.result}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium ${
                          game.blunders === 0 ? "text-[#18be5d]" :
                          game.blunders > 2 ? "text-[#f44336]" : "text-[#ff6f00]"
                        }`}>
                          {game.blunders} blunder{game.blunders !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: Blunder preview */}
                <div className="bg-[#3c3c3c]/30 rounded-lg border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[#f5f5f5] font-semibold">Blunder Analysis</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#f44336]/20 text-[#f44336] text-xs font-medium">-3.2</span>
                  </div>
                  {/* Chess board image */}
                  <img
                    src="/hero.png"
                    alt="Chess position"
                    className="w-full rounded-md border border-white/10 mb-4"
                  />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#f44336]">your move:</span>
                      <span className="text-[#f5f5f5] font-mono">Qf4</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#18be5d]">best move:</span>
                      <span className="text-[#f5f5f5] font-mono">Ne2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
