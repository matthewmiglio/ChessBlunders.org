"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Blunder } from "@/lib/supabase";
import { FilterCounts } from "@/lib/puzzle-filters";
import { Chess } from "chess.js";
import ChessBoard, { BOARD_THEMES } from "@/components/ChessBoard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Puzzle } from "@/app/api/practice/puzzles/route";
import { toast } from "sonner";


interface DetailedStats {
  currentRun: number;
  puzzlesCompleted: number;
  totalBlunders: number;
  puzzlesRemaining: number;
  percentComplete: number;
  gamesWithBlunders: number;
  solvedFirst: number;
  solvedSecond: number;
  solvedThirdPlus: number;
  currentStreak: number;
  bestStreak: number;
  runStartedAt: string | null;
}

// Get severity category from eval drop
function getSeverityCategory(evalDrop: number): "minor" | "medium" | "major" {
  if (evalDrop < 200) return "minor";
  if (evalDrop < 500) return "medium";
  return "major";
}

// Format duration from milliseconds
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
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

  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [currentBlunder, setCurrentBlunder] = useState<Blunder | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [currentBlunderIndex, setCurrentBlunderIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
    userMove?: string;
    rank?: MoveRank;
  } | null>(null);
  const [puzzlesLoading, setPuzzlesLoading] = useState(false);
  const [expectedMoveUci, setExpectedMoveUci] = useState<string>("");
  const [blunderMoveUci, setBlunderMoveUci] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const [filterCounts, setFilterCounts] = useState<FilterCounts | null>(null);
  const [currentPracticeRun, setCurrentPracticeRun] = useState<number>(1);
  const [resetting, setResetting] = useState(false);
  const [boardThemeIndex, setBoardThemeIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chessblunders_board_theme");
      return saved !== null ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [puzzleStartTime, setPuzzleStartTime] = useState<number | null>(null);
  const [solveTimes, setSolveTimes] = useState<number[]>([]);
  const [sessionStartTime] = useState<number>(() => Date.now());
  const [sessionElapsed, setSessionElapsed] = useState<number>(0);
  const [boardSize, setBoardSize] = useState<number>(500);
  const [cardWidth, setCardWidth] = useState<number>(200);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showIncorrect, setShowIncorrect] = useState(false);

  // Persist board theme to localStorage
  useEffect(() => {
    localStorage.setItem("chessblunders_board_theme", String(boardThemeIndex));
  }, [boardThemeIndex]);

  // Tick session timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionElapsed(Date.now() - sessionStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Calculate board size and card width to fill viewport without scrolling
  useEffect(() => {
    const updateLayout = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setIsDesktop(viewportWidth >= 1024);

      if (viewportWidth >= 1024) {
        // From layout.tsx: main has md:ml-72 (288px), lg:px-8 (32px each), sm:py-12 (48px each)
        const navbarMargin = 288; // ml-72 = 18rem = 288px
        const horizontalPadding = 64; // lg:px-8 = 32px * 2
        const verticalPadding = 96; // sm:py-12 = 48px * 2
        const footerHeight = 56;
        const gapSize = 16; // gap-4 between elements
        const horizontalGaps = gapSize * 2; // 2 gaps: card-board, board-card

        // Available height for content (viewport - vertical padding - footer)
        const maxBoardByHeight = viewportHeight - verticalPadding - footerHeight;

        // Available width for content (viewport - navbar - horizontal padding)
        const contentWidth = viewportWidth - navbarMargin - horizontalPadding;

        // Minimum card width
        const minCardWidth = 160;

        // Maximum board size based on width
        const maxBoardByWidth = contentWidth - (minCardWidth * 2) - horizontalGaps;

        // Board size is the smaller of height and width constraints
        const finalBoardSize = Math.max(280, Math.min(maxBoardByHeight, maxBoardByWidth));

        // Card width fills remaining horizontal space equally
        const remainingWidth = contentWidth - finalBoardSize - horizontalGaps;
        const finalCardWidth = Math.max(minCardWidth, Math.floor(remainingWidth / 2));

        setBoardSize(finalBoardSize);
        setCardWidth(finalCardWidth);
      } else {
        setBoardSize(Math.min(viewportWidth * 0.92, 500));
        setCardWidth(viewportWidth * 0.92);
      }
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  const currentTheme = BOARD_THEMES[boardThemeIndex] || BOARD_THEMES[0];

  // Dynamic scaling factor for card content based on board size
  // Base reference: 520px board = scale 1.0
  const scale = isDesktop ? Math.max(0.95, Math.min(1.65, boardSize / 520)) : 1;
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchDetailedStats();
      fetchPuzzles();
    }
  }, [user]);


  // Convert best_move and move_played to UCI when blunder changes
  useEffect(() => {
    if (currentBlunder) {
      const uci = sanToUci(currentBlunder.fen, currentBlunder.best_move);
      setExpectedMoveUci(uci || "");
      const blunderUci = sanToUci(currentBlunder.fen, currentBlunder.move_played);
      setBlunderMoveUci(blunderUci || "");
      setShowHint(false);
      // Start timing for this puzzle
      setPuzzleStartTime(Date.now());
    }
  }, [currentBlunder]);

  const fetchDetailedStats = async () => {
    try {
      const res = await fetch("/api/practice/stats");
      const data = await res.json();
      if (!data.error) {
        setDetailedStats(data);
      }
    } catch (error) {
    }
  };

  const fetchPuzzles = async () => {
    setPuzzlesLoading(true);
    try {
      // Always fetch only unsolved puzzles
      const res = await fetch(`/api/practice/puzzles?solved=false`);
      const data = await res.json();

      setPuzzles(data.puzzles || []);
      setFilterCounts(data.counts || null);
      if (data.currentPracticeRun) {
        setCurrentPracticeRun(data.currentPracticeRun);
      }

      // Pick a random puzzle
      if (data.puzzles?.length > 0 && !currentPuzzle) {
        pickRandomPuzzle(data.puzzles);
      }
    } catch (error) {
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
      // Track solve time
      if (puzzleStartTime) {
        const solveTime = Date.now() - puzzleStartTime;
        setSolveTimes(prev => [...prev, solveTime]);
      }

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
      setShowIncorrect(true);

      // Reset the puzzle after a brief delay
      setTimeout(() => {
        setPuzzleKey(prev => prev + 1); // Force board to reset
        setFeedback(null);
        setShowHint(false);
        setShowIncorrect(false);
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

      // Refresh detailed stats
      fetchDetailedStats();
    } catch (error) {
    }
  };

  const nextPuzzle = () => {
    // Remove the just-solved puzzle from the array
    if (currentPuzzle) {
      const remainingPuzzles = puzzles.filter(
        p => !(p.analysisId === currentPuzzle.analysisId && p.blunderIndex === currentPuzzle.blunderIndex)
      );
      setPuzzles(remainingPuzzles);
      pickRandomPuzzle(remainingPuzzles);
    } else {
      pickRandomPuzzle(puzzles);
    }
  };

  const handleStartNewRun = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/practice/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCurrentPracticeRun(data.newPracticeRun);
        toast.success(`Started practice run #${data.newPracticeRun}`);
        // Reset current puzzle state
        setCurrentPuzzle(null);
        setCurrentBlunder(null);
        setFeedback(null);
        // Reset solve times for new run
        setSolveTimes([]);
        // Refresh puzzles and stats
        await fetchPuzzles();
        await fetchDetailedStats();
      } else {
        toast.error(data.error || "Failed to start new run");
      }
    } catch (error) {
      toast.error("Failed to start new practice run");
    } finally {
      setResetting(false);
    }
  };

  const handleShowHint = () => {
    setShowHint(true);
  };

  if (authLoading) {
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
        <Link
          href="/games"
          className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-6 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
        >
          Go to Games
        </Link>
      </div>
    );
  }

  const playerSide = currentBlunder ? getPlayerSide(currentBlunder.fen) : "w";
  const hintArrow = showHint && expectedMoveUci ? {
    from: expectedMoveUci.slice(0, 2),
    to: expectedMoveUci.slice(2, 4)
  } : null;
  const blunderArrow = blunderMoveUci ? {
    from: blunderMoveUci.slice(0, 2),
    to: blunderMoveUci.slice(2, 4)
  } : null;

  const handlePieceClick = () => {
    // Hide hint arrow when user clicks a piece
    if (showHint) {
      setShowHint(false);
    }
  };

  return (
    <div>
      {/* All puzzles solved message */}
      {!puzzlesLoading && puzzles.length === 0 && filterCounts && filterCounts.all > 0 && (
        <div className="bg-[#202020] border border-white/10 rounded-lg p-8 text-center">
          <div className="w-16 h-16 rounded-lg bg-[#18be5d]/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[#18be5d]"
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
          </div>
          <h3 className="text-lg font-medium text-[#f5f5f5] mb-2">
            All puzzles solved!
          </h3>
          <p className="text-[#b4b4b4] mb-4">
            You've completed all {filterCounts.all} puzzles in practice run #{currentPracticeRun}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleStartNewRun}
              disabled={resetting}
              className="inline-flex items-center justify-center rounded-md bg-[#8a2be2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#8a2be2]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {resetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                "Start New Practice Run"
              )}
            </button>
            <Link
              href="/games"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-transparent px-5 py-2.5 text-sm font-medium text-[#b4b4b4] hover:bg-white/5 hover:text-[#f5f5f5] transition-colors"
            >
              Import More Games
            </Link>
          </div>
        </div>
      )}

      {currentBlunder && puzzles.length > 0 && (
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-4">
          {/* Left: Statistics Card */}
          <div
            className="flex-shrink-0 order-3 lg:order-1"
            style={{ width: isDesktop ? cardWidth : '100%', height: isDesktop ? boardSize : 'auto' }}
          >
            <div
              className="bg-[#202020] border border-white/10 rounded-lg flex flex-col h-full overflow-y-auto"
              style={{ padding: `${12 * scale}px ${14 * scale}px` }}
            >
              {/* Progress Section */}
              <div>
                <h3
                  className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                  style={{ fontSize: `${11 * scale}px`, marginBottom: `${6 * scale}px` }}
                >
                  Progress
                </h3>
                {/* Progress Bar */}
                <div style={{ marginBottom: `${6 * scale}px` }}>
                  <div className="flex justify-between" style={{ fontSize: `${12 * scale}px`, marginBottom: `${4 * scale}px` }}>
                    <span className="text-[#f5f5f5] font-medium">
                      {detailedStats?.puzzlesCompleted || 0} / {detailedStats?.totalBlunders || 0}
                    </span>
                    <span className="text-[#8a2be2] font-medium">
                      {detailedStats?.percentComplete || 0}%
                    </span>
                  </div>
                  <div className="bg-[#3c3c3c] rounded-full overflow-hidden" style={{ height: `${6 * scale}px` }}>
                    <div
                      className="h-full bg-[#8a2be2] rounded-full transition-all duration-300"
                      style={{ width: `${detailedStats?.percentComplete || 0}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2" style={{ gap: `${6 * scale}px`, fontSize: `${11 * scale}px` }}>
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Remaining</span>
                    <span className="text-[#f5f5f5]">{detailedStats?.puzzlesRemaining || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#b4b4b4]">Games</span>
                    <span className="text-[#f5f5f5]">{detailedStats?.gamesWithBlunders || 0}</span>
                  </div>
                </div>
              </div>

              {/* Accuracy Section */}
              <div className="border-t border-white/10" style={{ paddingTop: `${10 * scale}px`, marginTop: `${10 * scale}px` }}>
                <h3
                  className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                  style={{ fontSize: `${11 * scale}px`, marginBottom: `${6 * scale}px` }}
                >
                  Accuracy
                </h3>
                <div style={{ fontSize: `${11 * scale}px` }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: `${3 * scale}px` }}>
                    <span className="text-[#b4b4b4]">1st try</span>
                    <span className="text-[#18be5d] font-medium">{detailedStats?.solvedFirst || 0}</span>
                  </div>
                  <div className="flex justify-between items-center" style={{ marginBottom: `${3 * scale}px` }}>
                    <span className="text-[#b4b4b4]">2nd try</span>
                    <span className="text-[#3b82f6] font-medium">{detailedStats?.solvedSecond || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#b4b4b4]">3+ tries</span>
                    <span className="text-[#eab308] font-medium">{detailedStats?.solvedThirdPlus || 0}</span>
                  </div>
                </div>
              </div>

              {/* Streaks Section */}
              <div className="border-t border-white/10" style={{ paddingTop: `${10 * scale}px`, marginTop: `${10 * scale}px` }}>
                <h3
                  className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                  style={{ fontSize: `${11 * scale}px`, marginBottom: `${6 * scale}px` }}
                >
                  Streaks
                </h3>
                <div className="grid grid-cols-2" style={{ gap: `${6 * scale}px` }}>
                  <div className="bg-[#2a2a2a] rounded-md text-center" style={{ padding: `${6 * scale}px` }}>
                    <div className="font-bold text-[#f5f5f5]" style={{ fontSize: `${20 * scale}px` }}>{detailedStats?.currentStreak || 0}</div>
                    <div className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Current</div>
                  </div>
                  <div className="bg-[#2a2a2a] rounded-md text-center" style={{ padding: `${6 * scale}px` }}>
                    <div className="font-bold text-[#18be5d]" style={{ fontSize: `${20 * scale}px` }}>{detailedStats?.bestStreak || 0}</div>
                    <div className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Best</div>
                  </div>
                </div>
              </div>

              {/* Time Section */}
              <div className="border-t border-white/10" style={{ paddingTop: `${10 * scale}px`, marginTop: `${10 * scale}px` }}>
                <h3
                  className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                  style={{ fontSize: `${11 * scale}px`, marginBottom: `${6 * scale}px` }}
                >
                  Time
                </h3>
                <div style={{ fontSize: `${11 * scale}px` }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: `${3 * scale}px` }}>
                    <span className="text-[#b4b4b4]">Avg/puzzle</span>
                    <span className="text-[#f5f5f5] font-mono">
                      {solveTimes.length > 0
                        ? formatDuration(solveTimes.reduce((a, b) => a + b, 0) / solveTimes.length)
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center" style={{ marginBottom: `${3 * scale}px` }}>
                    <span className="text-[#b4b4b4]">Session</span>
                    <span className="text-[#f5f5f5] font-mono">
                      {formatDuration(sessionElapsed)}
                    </span>
                  </div>
                  {detailedStats?.runStartedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#b4b4b4]">Started</span>
                      <span className="text-[#f5f5f5]" style={{ fontSize: `${10 * scale}px` }}>
                        {new Date(detailedStats.runStartedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="border-t border-white/10" style={{ paddingTop: `${10 * scale}px`, marginTop: `${10 * scale}px` }}>
                <h3
                  className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                  style={{ fontSize: `${11 * scale}px`, marginBottom: `${6 * scale}px` }}
                >
                  By Severity
                </h3>
                {(() => {
                  const severityCounts = { minor: 0, medium: 0, major: 0 };
                  puzzles.forEach(p => {
                    const sev = getSeverityCategory(p.blunder.eval_drop);
                    severityCounts[sev]++;
                  });
                  const totalRemaining = puzzles.length;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${5 * scale}px` }}>
                      <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
                        <div className="flex-1 bg-[#3c3c3c] rounded-full overflow-hidden" style={{ height: `${5 * scale}px` }}>
                          <div className="h-full bg-[#eab308] rounded-full" style={{ width: totalRemaining > 0 ? `${(severityCounts.minor / totalRemaining) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-[#eab308]" style={{ fontSize: `${9 * scale}px`, width: `${50 * scale}px` }}>Minor ({severityCounts.minor})</span>
                      </div>
                      <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
                        <div className="flex-1 bg-[#3c3c3c] rounded-full overflow-hidden" style={{ height: `${5 * scale}px` }}>
                          <div className="h-full bg-[#f97316] rounded-full" style={{ width: totalRemaining > 0 ? `${(severityCounts.medium / totalRemaining) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-[#f97316]" style={{ fontSize: `${9 * scale}px`, width: `${50 * scale}px` }}>Med ({severityCounts.medium})</span>
                      </div>
                      <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
                        <div className="flex-1 bg-[#3c3c3c] rounded-full overflow-hidden" style={{ height: `${5 * scale}px` }}>
                          <div className="h-full bg-[#f44336] rounded-full" style={{ width: totalRemaining > 0 ? `${(severityCounts.major / totalRemaining) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-[#f44336]" style={{ fontSize: `${9 * scale}px`, width: `${50 * scale}px` }}>Major ({severityCounts.major})</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Spacer to fill remaining height */}
              <div className="flex-grow" />
            </div>
          </div>

          {/* Center: Chess Board */}
          <div className="flex-shrink-0 order-1 lg:order-2 relative">
            {/* Incorrect move overlay */}
            {showIncorrect && (
              <div className="absolute inset-0 bg-red-500/20 rounded-lg z-10 pointer-events-none flex items-center justify-center">
                <div className="bg-[#202020] border border-red-500/50 text-red-500 px-6 py-3 rounded-lg font-semibold text-xl shadow-lg">
                  Incorrect - Try again!
                </div>
              </div>
            )}
            <ChessBoard
              key={puzzleKey}
              fen={currentBlunder.fen}
              expectedMove={expectedMoveUci}
              onMoveResult={handleMoveResult}
              playerSide={playerSide}
              isActive={!feedback || !feedback.correct}
              hintArrow={hintArrow}
              blunderArrow={blunderArrow}
              onPieceClick={handlePieceClick}
              darkSquareColor={currentTheme.dark}
              lightSquareColor={currentTheme.light}
              size={boardSize}
            />
          </div>

          {/* Right: Info Panel */}
          <div
            className="flex-shrink-0 order-2 lg:order-3"
            style={{ width: isDesktop ? cardWidth : '100%', height: isDesktop ? boardSize : 'auto' }}
          >
            <div
              className="bg-[#202020] border border-white/10 rounded-lg flex flex-col h-full overflow-y-auto"
              style={{ padding: `${12 * scale}px ${14 * scale}px` }}
            >
              {/* Player to move */}
              <div className="text-center border-b border-white/10" style={{ paddingBottom: `${10 * scale}px` }}>
                <h2 className="font-bold text-[#f5f5f5]" style={{ fontSize: `${18 * scale}px` }}>
                  {playerSide === "w" ? "White" : "Black"} to move
                </h2>
              </div>

              {/* Puzzle Context */}
              {currentPuzzle?.game && (
                <div style={{ paddingTop: `${8 * scale}px` }}>
                  <h3
                    className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                    style={{ fontSize: `${10 * scale}px`, marginBottom: `${6 * scale}px` }}
                  >
                    Game Info
                  </h3>
                  <div className="flex flex-wrap" style={{ gap: `${4 * scale}px` }}>
                    <span
                      className="inline-flex items-center rounded bg-[#3c3c3c] text-[#b4b4b4]"
                      style={{ gap: `${3 * scale}px`, padding: `${4 * scale}px ${6 * scale}px`, fontSize: `${10 * scale}px` }}
                    >
                      <svg style={{ width: `${12 * scale}px`, height: `${12 * scale}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {currentPuzzle.game.time_class || "?"}
                    </span>
                    <span
                      className="inline-flex items-center rounded bg-[#3c3c3c] text-[#b4b4b4]"
                      style={{ gap: `${3 * scale}px`, padding: `${4 * scale}px ${6 * scale}px`, fontSize: `${10 * scale}px` }}
                    >
                      <svg style={{ width: `${12 * scale}px`, height: `${12 * scale}px` }} fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill={currentPuzzle.game.user_color === "white" ? "#fff" : "#333"} stroke="#666" strokeWidth="1"/>
                      </svg>
                      {currentPuzzle.game.user_color === "white" ? "W" : "B"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded ${
                        currentPuzzle.resultCategory === "win"
                          ? "bg-[#18be5d]/20 text-[#18be5d]"
                          : currentPuzzle.resultCategory === "loss"
                          ? "bg-[#f44336]/20 text-[#f44336]"
                          : "bg-[#808080]/20 text-[#808080]"
                      }`}
                      style={{ gap: `${3 * scale}px`, padding: `${4 * scale}px ${6 * scale}px`, fontSize: `${10 * scale}px` }}
                    >
                      <svg style={{ width: `${12 * scale}px`, height: `${12 * scale}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {currentPuzzle.resultCategory === "win" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        ) : currentPuzzle.resultCategory === "loss" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8" />
                        )}
                      </svg>
                      {currentPuzzle.resultCategory === "win" ? "W" : currentPuzzle.resultCategory === "loss" ? "L" : "D"}
                    </span>
                    <span
                      className="inline-flex items-center rounded bg-[#3c3c3c] text-[#b4b4b4]"
                      style={{ gap: `${3 * scale}px`, padding: `${4 * scale}px ${6 * scale}px`, fontSize: `${10 * scale}px` }}
                    >
                      #{currentBlunder.move_number}
                    </span>
                  </div>
                </div>
              )}

              {/* Position Info OR Feedback (mutually exclusive) */}
              {feedback?.correct ? (
                <div style={{ paddingTop: `${8 * scale}px` }}>
                  {/* Feedback Banner */}
                  <div
                    className={`rounded-md ${
                      feedback.rank === 1
                        ? "bg-[#18be5d]/10 border border-[#18be5d]/30 text-[#18be5d]"
                        : feedback.rank === 2
                        ? "bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6]"
                        : "bg-[#eab308]/10 border border-[#eab308]/30 text-[#eab308]"
                    }`}
                    style={{ padding: `${8 * scale}px`, marginBottom: `${8 * scale}px` }}
                  >
                    <div className="flex items-center" style={{ gap: `${6 * scale}px` }}>
                      <svg style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-semibold" style={{ fontSize: `${12 * scale}px` }}>
                        {feedback.rank === 1 ? "Best Move!" : feedback.rank === 2 ? "#2 Move!" : "#3 Move!"}
                      </span>
                    </div>
                  </div>

                  {/* Top Moves */}
                  <h3
                    className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                    style={{ fontSize: `${10 * scale}px`, marginBottom: `${6 * scale}px` }}
                  >
                    Top Moves
                  </h3>
                  {currentBlunder?.top_moves && currentBlunder.top_moves.length > 0 ? (
                    <div>
                      {currentBlunder.top_moves.map((m, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center border-b border-white/5 last:border-0"
                          style={{ padding: `${4 * scale}px 0` }}
                        >
                          <div className="flex items-center" style={{ gap: `${4 * scale}px` }}>
                            <span className={`font-medium ${
                              i === 0 ? "text-[#18be5d]" : i === 1 ? "text-[#3b82f6]" : "text-[#eab308]"
                            }`} style={{ fontSize: `${10 * scale}px` }}>#{i + 1}</span>
                            <span className="font-mono font-bold text-[#f5f5f5]" style={{ fontSize: `${12 * scale}px` }}>
                              {uciToSan(currentBlunder.fen, m.move) || m.move}
                            </span>
                          </div>
                          <span className="font-mono text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>
                            {m.score > 0 ? '+' : ''}{(m.score / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between items-center" style={{ padding: `${4 * scale}px 0` }}>
                      <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Best move</span>
                      <span className="font-mono text-[#18be5d]" style={{ fontSize: `${12 * scale}px` }}>{currentBlunder.best_move}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ paddingTop: `${8 * scale}px` }}>
                  <h3
                    className="font-medium text-[#b4b4b4] uppercase tracking-wider"
                    style={{ fontSize: `${10 * scale}px`, marginBottom: `${6 * scale}px` }}
                  >
                    Position Info
                  </h3>
                  <div>
                    <div className="flex justify-between items-center border-b border-white/5" style={{ padding: `${4 * scale}px 0` }}>
                      <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>You played</span>
                      <span className="font-mono text-[#f44336]" style={{ fontSize: `${12 * scale}px` }}>
                        {currentBlunder.move_played}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5" style={{ padding: `${4 * scale}px 0` }}>
                      <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Eval before</span>
                      <span className="font-mono text-[#f5f5f5]" style={{ fontSize: `${12 * scale}px` }}>
                        {currentBlunder.eval_before > 0 ? "+" : ""}
                        {(currentBlunder.eval_before / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5" style={{ padding: `${4 * scale}px 0` }}>
                      <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Eval after</span>
                      <span className="font-mono text-[#f44336]" style={{ fontSize: `${12 * scale}px` }}>
                        {currentBlunder.eval_after > 0 ? "+" : ""}
                        {(currentBlunder.eval_after / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center" style={{ padding: `${4 * scale}px 0` }}>
                      <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Eval drop</span>
                      <span className="font-mono text-[#f44336]" style={{ fontSize: `${12 * scale}px` }}>
                        -{currentBlunder.eval_drop} cp
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Board Theme Selector */}
              <div className="relative border-t border-white/10" style={{ paddingTop: `${8 * scale}px`, marginTop: `${8 * scale}px` }}>
                <div className="flex items-center justify-between" style={{ padding: `${4 * scale}px 0` }}>
                  <span className="text-[#b4b4b4]" style={{ fontSize: `${10 * scale}px` }}>Theme</span>
                  <button
                    onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                    className="flex items-center rounded-md border border-white/10 hover:bg-white/5 transition-colors"
                    style={{ gap: `${4 * scale}px`, padding: `${4 * scale}px ${6 * scale}px` }}
                  >
                    <div className="flex" style={{ gap: `${2 * scale}px` }}>
                      <div className="rounded-sm" style={{ width: `${12 * scale}px`, height: `${12 * scale}px`, backgroundColor: currentTheme.dark }} />
                      <div className="rounded-sm" style={{ width: `${12 * scale}px`, height: `${12 * scale}px`, backgroundColor: currentTheme.light }} />
                    </div>
                  </button>
                </div>

                {showThemeDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-full bg-[#2a2a2a] border border-white/10 rounded-md z-10 max-h-48 overflow-y-auto">
                    {BOARD_THEMES.map((theme, index) => (
                      <button
                        key={theme.name}
                        onClick={() => {
                          setBoardThemeIndex(index);
                          setShowThemeDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors ${
                          index === boardThemeIndex ? "bg-white/10" : ""
                        }`}
                      >
                        <span className="text-sm text-[#f5f5f5]">{theme.name}</span>
                        <div className="flex gap-1">
                          <div className="w-5 h-5 rounded-sm border border-white/10" style={{ backgroundColor: theme.dark }} />
                          <div className="w-5 h-5 rounded-sm border border-white/10" style={{ backgroundColor: theme.light }} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Spacer to fill remaining height */}
              <div className="flex-grow" />

              {/* Hint Button OR Next Puzzle Button */}
              {feedback?.correct ? (
                <button
                  onClick={nextPuzzle}
                  className="w-full rounded-md bg-[#8a2be2] text-white hover:bg-[#8a2be2]/90 transition-colors font-medium"
                  style={{ padding: `${8 * scale}px ${12 * scale}px`, fontSize: `${12 * scale}px` }}
                >
                  Next Puzzle
                </button>
              ) : !showHint && (
                <button
                  onClick={handleShowHint}
                  className="w-full rounded-md border border-[#ff6f00]/30 bg-[#ff6f00]/10 text-[#ff6f00] hover:bg-[#ff6f00]/20 transition-colors font-medium"
                  style={{ padding: `${8 * scale}px ${12 * scale}px`, fontSize: `${12 * scale}px` }}
                >
                  Show Hint
                </button>
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
