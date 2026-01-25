"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Analysis, Blunder } from "@/lib/supabase";
import { Chess } from "chess.js";
import ChessBoard from "@/components/ChessBoard";

interface UserStats {
  total_games: number;
  analyzed_games: number;
  total_blunders: number;
  solved_blunders: number;
  total_attempts: number;
}

// Convert SAN move to UCI format using a chess position
function sanToUci(fen: string, san: string): string | null {
  try {
    const game = new Chess(fen);
    const move = game.move(san);
    if (move) {
      return move.from + move.to + (move.promotion || "");
    }
  } catch {
    console.warn("Failed to convert SAN to UCI:", san);
  }
  return null;
}

// Get player side from FEN (whose turn it is)
function getPlayerSide(fen: string): "w" | "b" {
  const parts = fen.split(" ");
  return parts[1] === "b" ? "b" : "w";
}

function PracticeContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("analysisId");
  const blunderIndexParam = searchParams.get("blunderIndex");

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [currentBlunder, setCurrentBlunder] = useState<Blunder | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(
    null
  );
  const [currentBlunderIndex, setCurrentBlunderIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
    userMove?: string;
  } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expectedMoveUci, setExpectedMoveUci] = useState<string>("");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (analysisId && blunderIndexParam !== null && analyses.length > 0) {
      const analysis = analyses.find((a) => a.id === analysisId);
      if (analysis && analysis.blunders.length > 0) {
        const idx = parseInt(blunderIndexParam);
        setCurrentAnalysisId(analysisId);
        setCurrentBlunderIndex(idx);
        setCurrentBlunder(analysis.blunders[idx]);
      }
    }
  }, [analysisId, blunderIndexParam, analyses]);

  // Convert best_move to UCI when blunder changes
  useEffect(() => {
    if (currentBlunder) {
      const uci = sanToUci(currentBlunder.fen, currentBlunder.best_move);
      setExpectedMoveUci(uci || "");
      setShowHint(false);
    }
  }, [currentBlunder]);

  const fetchData = async () => {
    try {
      const [analysesRes, userRes] = await Promise.all([
        fetch("/api/analysis"),
        fetch("/api/user"),
      ]);

      const analysesData = await analysesRes.json();
      const userData = await userRes.json();

      setAnalyses(analysesData.analyses || []);
      setStats(userData.stats);

      // If no specific blunder requested, pick a random one
      if (!analysisId && analysesData.analyses?.length > 0) {
        pickRandomBlunder(analysesData.analyses);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const pickRandomBlunder = useCallback((availableAnalyses: Analysis[]) => {
    const analysesWithBlunders = availableAnalyses.filter(
      (a) => a.blunders.length > 0
    );
    if (analysesWithBlunders.length === 0) return;

    const randomAnalysis =
      analysesWithBlunders[
        Math.floor(Math.random() * analysesWithBlunders.length)
      ];
    const randomIndex = Math.floor(
      Math.random() * randomAnalysis.blunders.length
    );

    setCurrentAnalysisId(randomAnalysis.id);
    setCurrentBlunderIndex(randomIndex);
    setCurrentBlunder(randomAnalysis.blunders[randomIndex]);
    setFeedback(null);
    setShowHint(false);
  }, []);

  const handleMoveResult = async (correct: boolean, userMoveUci: string) => {
    if (!currentBlunder || !currentAnalysisId) return;

    setFeedback({
      correct,
      message: correct
        ? "Correct! That's the best move."
        : `Incorrect. The best move was ${currentBlunder.best_move}`,
      userMove: userMoveUci,
    });

    // Record attempt
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: currentAnalysisId,
          blunderIndex: currentBlunderIndex,
          solved: correct,
        }),
      });

      // Refresh stats
      const userRes = await fetch("/api/user");
      const userData = await userRes.json();
      setStats(userData.stats);
    } catch (error) {
      console.error("Error recording progress:", error);
    }
  };

  const nextBlunder = () => {
    pickRandomBlunder(analyses);
  };

  const handleShowHint = () => {
    setShowHint(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  const analysesWithBlunders = analyses.filter((a) => a.blunders.length > 0);

  if (analysesWithBlunders.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-4">
          Practice Mode
        </h1>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          No blunders to practice yet. Analyze some games first to find
          positions to train on.
        </p>
        <button
          onClick={() => router.push("/games")}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-sky-400 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-all"
        >
          Go to Games
        </button>
      </div>
    );
  }

  const playerSide = currentBlunder ? getPlayerSide(currentBlunder.fen) : "w";
  const hintSquare = showHint && expectedMoveUci ? expectedMoveUci.slice(2, 4) : null;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-8">
        Practice Mode
      </h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 text-center">
            <p className="text-2xl font-semibold text-white">
              {stats.total_blunders}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
              Total Blunders
            </p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 text-center">
            <p className="text-2xl font-semibold text-emerald-400">
              {stats.solved_blunders}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
              Solved
            </p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 text-center">
            <p className="text-2xl font-semibold text-white">
              {stats.total_attempts}
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
              Total Attempts
            </p>
          </div>
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 text-center">
            <p className="text-2xl font-semibold text-sky-400">
              {stats.total_attempts > 0
                ? Math.round(
                    (stats.solved_blunders / stats.total_attempts) * 100
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
              Success Rate
            </p>
          </div>
        </div>
      )}

      {currentBlunder && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Chess Board */}
          <div className="flex-1 lg:max-w-[60%]">
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {playerSide === "w" ? "White" : "Black"} to move
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Find the best move
                </p>
              </div>

              <ChessBoard
                fen={currentBlunder.fen}
                expectedMove={expectedMoveUci}
                onMoveResult={handleMoveResult}
                playerSide={playerSide}
                isActive={!feedback}
                highlightSquare={hintSquare}
              />
            </div>
          </div>

          {/* Right: Info Panel */}
          <div className="flex-1 lg:max-w-[40%]">
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
              {/* Blunder Info */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Position Info
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">You played</span>
                    <span className="font-mono text-red-400">
                      {currentBlunder.move_played}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Eval before</span>
                    <span className="font-mono text-slate-300">
                      {currentBlunder.eval_before > 0 ? "+" : ""}
                      {(currentBlunder.eval_before / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Eval after</span>
                    <span className="font-mono text-red-400">
                      {currentBlunder.eval_after > 0 ? "+" : ""}
                      {(currentBlunder.eval_after / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">Eval drop</span>
                    <span className="font-mono text-red-400">
                      -{currentBlunder.eval_drop} cp
                    </span>
                  </div>
                </div>
              </div>

              {/* Hint Button */}
              {!feedback && !showHint && (
                <button
                  onClick={handleShowHint}
                  className="w-full py-3 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-medium"
                >
                  Show Hint
                </button>
              )}

              {/* Feedback */}
              {feedback && (
                <div className="space-y-4">
                  <div
                    className={`p-5 rounded-xl ${
                      feedback.correct
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {feedback.correct ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                      <span className="font-semibold">
                        {feedback.correct ? "Correct!" : "Incorrect"}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{feedback.message}</p>
                  </div>

                  <button
                    onClick={nextBlunder}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-violet-400 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 transition-all"
                  >
                    Next Blunder
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
