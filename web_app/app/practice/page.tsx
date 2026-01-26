"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Blunder } from "@/lib/supabase";
import { PuzzleFilters, FilterCounts } from "@/lib/puzzle-filters";
import { Chess } from "chess.js";
import ChessBoard from "@/components/ChessBoard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatCard } from "@/components/StatCard";
import { FilterBar } from "@/components/FilterBar";
import { Puzzle } from "@/app/api/practice/puzzles/route";

interface UserStats {
  total_games: number;
  analyzed_games: number;
  total_blunders: number;
  solved_blunders: number;
  total_attempts: number;
}

const FILTER_STORAGE_KEY = "chessblunders_practice_filters";

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

// Convert UCI move to SAN format using a chess position
function uciToSan(fen: string, uci: string): string | null {
  try {
    const game = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = game.move({ from, to, promotion });
    if (move) {
      return move.san;
    }
  } catch {
    console.warn("Failed to convert UCI to SAN:", uci);
  }
  return null;
}

// Type for move rank (1 = best, 2 = second best, 3 = third best, null = not in top 3)
type MoveRank = 1 | 2 | 3 | null;

// Check user's move against top 3 moves
function checkMoveRank(userMoveUci: string, blunder: Blunder): MoveRank {
  // Handle old blunders without top_moves
  if (!blunder.top_moves || blunder.top_moves.length === 0) {
    // Convert best_move from SAN to UCI for comparison
    const bestMoveUci = sanToUci(blunder.fen, blunder.best_move);
    return userMoveUci === bestMoveUci ? 1 : null;
  }

  // Check against all top moves
  for (let i = 0; i < blunder.top_moves.length; i++) {
    if (userMoveUci === blunder.top_moves[i].move) {
      return (i + 1) as MoveRank;
    }
  }
  return null;
}

// Get feedback based on move rank
function getMoveRankFeedback(rank: MoveRank): { message: string; isCorrect: boolean } {
  switch (rank) {
    case 1:
      return { message: "Best move! Well done.", isCorrect: true };
    case 2:
      return { message: "That's the #2 move - good!", isCorrect: true };
    case 3:
      return { message: "That's the #3 move - acceptable.", isCorrect: true };
    default:
      return { message: "Incorrect. Try again!", isCorrect: false };
  }
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
  const clearFiltersParam = searchParams.get("clearFilters");

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [currentBlunder, setCurrentBlunder] = useState<Blunder | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(
    null
  );
  const [currentBlunderIndex, setCurrentBlunderIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
    userMove?: string;
    rank?: MoveRank;
  } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [puzzlesLoading, setPuzzlesLoading] = useState(true);
  const [expectedMoveUci, setExpectedMoveUci] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state - default to showing unsolved puzzles
  const [filters, setFilters] = useState<PuzzleFilters>(() => {
    const defaultFilters: PuzzleFilters = { solved: false };
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return defaultFilters;
        }
      }
    }
    return defaultFilters;
  });
  const [filterCounts, setFilterCounts] = useState<FilterCounts | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  // Clear filters when coming from analysis page with a specific puzzle
  useEffect(() => {
    if (clearFiltersParam === "true") {
      setFilters({});
      localStorage.removeItem(FILTER_STORAGE_KEY);
    }
  }, [clearFiltersParam]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  // Persist filters to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    }
  }, [filters]);

  // Fetch puzzles when filters change
  useEffect(() => {
    if (user) {
      fetchPuzzles();
    }
  }, [user, filters]);

  useEffect(() => {
    if (analysisId && blunderIndexParam !== null && puzzles.length > 0) {
      const puzzle = puzzles.find(
        (p) => p.analysisId === analysisId && p.blunderIndex === parseInt(blunderIndexParam)
      );
      if (puzzle) {
        setCurrentPuzzle(puzzle);
        setCurrentAnalysisId(puzzle.analysisId);
        setCurrentBlunderIndex(puzzle.blunderIndex);
        setCurrentBlunder(puzzle.blunder);
      }
    }
  }, [analysisId, blunderIndexParam, puzzles]);

  // Convert best_move to UCI when blunder changes
  useEffect(() => {
    if (currentBlunder) {
      const uci = sanToUci(currentBlunder.fen, currentBlunder.best_move);
      setExpectedMoveUci(uci || "");
      setShowHint(false);
    }
  }, [currentBlunder]);

  const fetchStats = async () => {
    try {
      const userRes = await fetch("/api/user");
      const userData = await userRes.json();
      setStats(userData.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPuzzles = async () => {
    setPuzzlesLoading(true);
    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters.phase) params.set("phase", filters.phase);
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.timeControl) params.set("timeControl", filters.timeControl);
      if (filters.color) params.set("color", filters.color);
      if (filters.result) params.set("result", filters.result);
      if (filters.pieceType) params.set("pieceType", filters.pieceType);
      if (filters.dateRange) params.set("dateRange", filters.dateRange);
      if (filters.openingFamily) params.set("openingFamily", filters.openingFamily);
      if (filters.solved !== undefined) params.set("solved", String(filters.solved));

      const res = await fetch(`/api/practice/puzzles?${params.toString()}`);
      const data = await res.json();

      setPuzzles(data.puzzles || []);
      setFilterCounts(data.counts || null);

      // If no specific puzzle requested, pick a random one
      if (!analysisId && data.puzzles?.length > 0 && !currentPuzzle) {
        pickRandomPuzzle(data.puzzles);
      }
    } catch (error) {
      console.error("Error fetching puzzles:", error);
    } finally {
      setPuzzlesLoading(false);
    }
  };

  const pickRandomPuzzle = useCallback((availablePuzzles: Puzzle[]) => {
    if (availablePuzzles.length === 0) return;

    const randomPuzzle =
      availablePuzzles[Math.floor(Math.random() * availablePuzzles.length)];

    setCurrentPuzzle(randomPuzzle);
    setCurrentAnalysisId(randomPuzzle.analysisId);
    setCurrentBlunderIndex(randomPuzzle.blunderIndex);
    setCurrentBlunder(randomPuzzle.blunder);
    setFeedback(null);
    setShowHint(false);
    setPuzzleKey(prev => prev + 1);
  }, []);

  const [puzzleKey, setPuzzleKey] = useState(0); // Key to force board reset

  const handleMoveResult = async (_correct: boolean, userMoveUci: string) => {
    if (!currentBlunder || !currentAnalysisId) return;

    // Check move against top 3 moves
    const rank = checkMoveRank(userMoveUci, currentBlunder);
    const { message, isCorrect } = getMoveRankFeedback(rank);

    if (isCorrect) {
      // Show success feedback
      setFeedback({
        correct: isCorrect,
        message,
        userMove: userMoveUci,
        rank,
      });
    } else {
      // Show brief incorrect feedback, then reset puzzle
      setFeedback({
        correct: false,
        message,
        userMove: userMoveUci,
        rank: null,
      });

      // Reset the puzzle after a brief delay
      setTimeout(() => {
        setPuzzleKey(prev => prev + 1); // Force board to reset
        setFeedback(null);
        setShowHint(false);
      }, 800);
    }

    // Record attempt with move details for granular tracking
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: currentAnalysisId,
          blunderIndex: currentBlunderIndex,
          solved: isCorrect,
          movePlayed: userMoveUci,
          moveRank: rank,
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

  const nextPuzzle = () => {
    // If filtering by unsolved, remove the just-solved puzzle from the array
    if (filters.solved === false && currentPuzzle) {
      const remainingPuzzles = puzzles.filter(
        p => !(p.analysisId === currentPuzzle.analysisId && p.blunderIndex === currentPuzzle.blunderIndex)
      );
      setPuzzles(remainingPuzzles);
      pickRandomPuzzle(remainingPuzzles);
    } else {
      pickRandomPuzzle(puzzles);
    }
  };

  const handleShowHint = () => {
    setShowHint(true);
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  // Show empty state if no puzzles after initial load
  if (!puzzlesLoading && puzzles.length === 0 && filterCounts?.all === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-lg bg-[#3c3c3c] flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-[#b4b4b4]"
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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5] mb-4">
          Practice Mode
        </h1>
        <p className="text-[#b4b4b4] mb-8 max-w-md mx-auto">
          No blunders to practice yet. Analyze some games first to find
          positions to train on.
        </p>
        <button
          onClick={() => router.push("/games")}
          className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-6 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
        >
          Go to Games
        </button>
      </div>
    );
  }

  const playerSide = currentBlunder ? getPlayerSide(currentBlunder.fen) : "w";
  const hintArrow = showHint && expectedMoveUci ? {
    from: expectedMoveUci.slice(0, 2),
    to: expectedMoveUci.slice(2, 4)
  } : null;

  const handlePieceClick = () => {
    // Hide hint arrow when user clicks a piece
    if (showHint) {
      setShowHint(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined
  ).length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
          Practice Mode
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? "bg-[#8a2be2] text-white"
              : "bg-[#3c3c3c] text-[#b4b4b4] hover:bg-[#4c4c4c]"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="mb-6">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            counts={filterCounts}
            loading={puzzlesLoading}
          />
        </div>
      )}

      {/* Puzzle count summary */}
      {filterCounts && (
        <div className="mb-6 text-sm text-[#b4b4b4]">
          {activeFilterCount > 0 ? (
            <span>
              Showing <span className="text-[#f5f5f5] font-medium">{puzzles.length}</span> of{" "}
              <span className="text-[#f5f5f5] font-medium">{filterCounts.all}</span> puzzles
            </span>
          ) : (
            <span>
              <span className="text-[#f5f5f5] font-medium">{filterCounts.all}</span> puzzles available
            </span>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Blunders" value={stats.total_blunders} centered />
          <StatCard label="Solved" value={stats.solved_blunders} valueColor="text-[#18be5d]" centered />
          <StatCard label="Total Attempts" value={stats.total_attempts} centered />
          <StatCard
            label="Success Rate"
            value={`${stats.total_attempts > 0 ? Math.round((stats.solved_blunders / stats.total_attempts) * 100) : 0}%`}
            valueColor="text-[#f44336]"
            centered
          />
        </div>
      )}

      {/* No matching puzzles message */}
      {!puzzlesLoading && puzzles.length === 0 && filterCounts && filterCounts.all > 0 && (
        <div className="bg-[#202020] border border-white/10 rounded-lg p-8 text-center">
          <div className="w-16 h-16 rounded-lg bg-[#3c3c3c] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[#b4b4b4]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#f5f5f5] mb-2">
            No puzzles match your filters
          </h3>
          <p className="text-[#b4b4b4] mb-4">
            Try adjusting your filter criteria to see more puzzles.
          </p>
          <button
            onClick={() => setFilters({})}
            className="inline-flex items-center justify-center rounded-md bg-[#8a2be2] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a2be2]/90 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {currentBlunder && puzzles.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Chess Board */}
          <div className="flex-1 lg:max-w-[60%]">
            <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-[#f5f5f5]">
                  {playerSide === "w" ? "White" : "Black"} to move
                </h2>
                <p className="text-[#b4b4b4] text-sm mt-1">
                  Find the best move
                </p>
              </div>

              <ChessBoard
                key={puzzleKey}
                fen={currentBlunder.fen}
                expectedMove={expectedMoveUci}
                onMoveResult={handleMoveResult}
                playerSide={playerSide}
                isActive={!feedback || !feedback.correct}
                hintArrow={hintArrow}
                onPieceClick={handlePieceClick}
              />
            </div>
          </div>

          {/* Right: Info Panel */}
          <div className="flex-1 lg:max-w-[40%]">
            <div className="bg-[#202020] border border-white/10 rounded-lg p-6 space-y-6">
              {/* Puzzle Context */}
              {currentPuzzle?.game && (
                <div>
                  <h3 className="text-sm font-medium text-[#b4b4b4] uppercase tracking-wider mb-3">
                    Game Info
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs rounded bg-[#3c3c3c] text-[#b4b4b4]">
                      {currentPuzzle.game.time_class || "Unknown"}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-[#3c3c3c] text-[#b4b4b4]">
                      {currentPuzzle.game.user_color === "white" ? "White" : "Black"}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      currentPuzzle.resultCategory === "win"
                        ? "bg-[#18be5d]/20 text-[#18be5d]"
                        : currentPuzzle.resultCategory === "loss"
                        ? "bg-[#f44336]/20 text-[#f44336]"
                        : "bg-[#808080]/20 text-[#808080]"
                    }`}>
                      {currentPuzzle.resultCategory === "win"
                        ? "Won"
                        : currentPuzzle.resultCategory === "loss"
                        ? "Lost"
                        : "Draw"}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-[#3c3c3c] text-[#b4b4b4]">
                      Move {currentBlunder.move_number}
                    </span>
                  </div>
                </div>
              )}

              {/* Blunder Info */}
              <div>
                <h3 className="text-sm font-medium text-[#b4b4b4] uppercase tracking-wider mb-3">
                  Position Info
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[#b4b4b4]">You played</span>
                    <span className="font-mono text-[#f44336]">
                      {currentBlunder.move_played}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[#b4b4b4]">Eval before</span>
                    <span className="font-mono text-[#f5f5f5]">
                      {currentBlunder.eval_before > 0 ? "+" : ""}
                      {(currentBlunder.eval_before / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[#b4b4b4]">Eval after</span>
                    <span className="font-mono text-[#f44336]">
                      {currentBlunder.eval_after > 0 ? "+" : ""}
                      {(currentBlunder.eval_after / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[#b4b4b4]">Eval drop</span>
                    <span className="font-mono text-[#f44336]">
                      -{currentBlunder.eval_drop} cp
                    </span>
                  </div>
                </div>
              </div>

              {/* Hint Button */}
              {!feedback && !showHint && (
                <button
                  onClick={handleShowHint}
                  className="w-full py-3 px-4 rounded-md border border-[#ff6f00]/30 bg-[#ff6f00]/10 text-[#ff6f00] hover:bg-[#ff6f00]/20 transition-colors text-sm font-medium"
                >
                  Show Hint
                </button>
              )}

              {/* Feedback */}
              {feedback && (
                <div className="space-y-4">
                  <div
                    className={`p-5 rounded-md ${
                      feedback.rank === 1
                        ? "bg-[#18be5d]/10 border border-[#18be5d]/30 text-[#18be5d]"
                        : feedback.rank === 2
                        ? "bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6]"
                        : feedback.rank === 3
                        ? "bg-[#eab308]/10 border border-[#eab308]/30 text-[#eab308]"
                        : "bg-[#f44336]/10 border border-[#f44336]/30 text-[#f44336]"
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
                        {feedback.rank === 1 ? "Best Move!" :
                         feedback.rank === 2 ? "#2 Move!" :
                         feedback.rank === 3 ? "#3 Move!" : "Incorrect"}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{feedback.message}</p>
                  </div>

                  {/* Show all top moves after solving */}
                  {feedback.correct && currentBlunder?.top_moves && currentBlunder.top_moves.length > 0 && (
                    <div className="bg-[#2a2a2a] border border-white/10 p-4 rounded-md">
                      <p className="text-sm text-[#b4b4b4] mb-3">Top moves in this position:</p>
                      {currentBlunder.top_moves.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                          <span className={`w-6 text-sm font-medium ${
                            i === 0 ? "text-[#18be5d]" :
                            i === 1 ? "text-[#3b82f6]" :
                            "text-[#eab308]"
                          }`}>#{i + 1}</span>
                          <span className="font-mono font-bold text-[#f5f5f5]">
                            {uciToSan(currentBlunder.fen, m.move) || m.move}
                          </span>
                          <span className="text-sm text-[#b4b4b4]">
                            ({m.score > 0 ? '+' : ''}{(m.score / 100).toFixed(2)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {feedback.correct && (
                    <button
                      onClick={nextPuzzle}
                      className="w-full inline-flex items-center justify-center rounded-md bg-[#8a2be2] px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-[#8a2be2]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8a2be2] transition-all"
                    >
                      Next Puzzle
                    </button>
                  )}
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
    <Suspense fallback={<LoadingSpinner />}>
      <PracticeContent />
    </Suspense>
  );
}
