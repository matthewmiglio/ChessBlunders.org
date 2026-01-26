"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Analysis, Blunder } from "@/lib/supabase";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatCard } from "@/components/StatCard";
import { BoardPreview } from "@/components/BoardPreview";

const BATCH_SIZE = 20;

interface UnanalyzedGame {
  id: string;
  pgn: string;
  user_color: string | null;
}

function AnalysisContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("id");

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGames: 0,
    analyzedGames: 0,
    isPremium: false,
    retentionLimit: 100 as number | null
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [retentionLimitReached, setRetentionLimitReached] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchAnalyses();
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    if (analysisId && analyses.length > 0) {
      const found = analyses.find((a) => a.id === analysisId);
      if (found) {
        setSelectedAnalysis(found);
      }
    }
  }, [analysisId, analyses]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/analysis/stats");
      const data = await response.json();
      setStats({
        totalGames: data.totalGames || 0,
        analyzedGames: data.analyzedGames || 0,
        isPremium: data.isPremium || false,
        retentionLimit: data.retentionLimit,
      });
      if (!data.isPremium && data.retentionLimit && data.analyzedGames >= data.retentionLimit) {
        setRetentionLimitReached(true);
      } else {
        setRetentionLimitReached(false);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchAnalyses = async () => {
    try {
      const response = await fetch("/api/analysis");
      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (error) {
      console.error("Error fetching analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAll = async () => {
    setAnalyzing(true);
    abortRef.current = false;
    console.log("[analyzeAll] Starting analysis...");

    try {
      // Fetch unanalyzed games
      console.log("[analyzeAll] Fetching unanalyzed games...");
      const response = await fetch("/api/analysis/unanalyzed");
      const data = await response.json();
      console.log("[analyzeAll] Unanalyzed response:", {
        ok: response.ok,
        total: data.total,
        alreadyAnalyzed: data.alreadyAnalyzed,
        gamesCount: data.games?.length,
        limitReached: data.limitReached,
        remainingSlots: data.remainingSlots,
        isPremium: data.isPremium
      });

      if (!response.ok) {
        console.log("[analyzeAll] Response not OK:", data.error);
        toast.error(data.error || "Failed to fetch games");
        setAnalyzing(false);
        return;
      }

      if (data.limitReached) {
        console.log("[analyzeAll] Limit reached, stopping");
        setRetentionLimitReached(true);
        toast.error("Free analysis limit reached");
        setAnalyzing(false);
        return;
      }

      const unanalyzedGames: UnanalyzedGame[] = data.games || [];
      console.log("[analyzeAll] Unanalyzed games IDs:", unanalyzedGames.map(g => g.id));

      if (unanalyzedGames.length === 0) {
        console.log("[analyzeAll] No unanalyzed games found!");
        toast.info("All games are already analyzed!");
        setAnalyzing(false);
        return;
      }

      const totalToAnalyze = unanalyzedGames.length;
      const startingCount = data.alreadyAnalyzed || 0;
      console.log("[analyzeAll] Starting count:", startingCount, "Total to analyze:", totalToAnalyze);

      setAnalyzeProgress({
        current: startingCount,
        total: startingCount + totalToAnalyze
      });

      let analyzed = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < unanalyzedGames.length; i += BATCH_SIZE) {
        if (abortRef.current) {
          console.log("[analyzeAll] Aborted by user");
          toast.info(`Analysis stopped. ${analyzed} games analyzed.`);
          break;
        }

        const batch = unanalyzedGames.slice(i, i + BATCH_SIZE);
        console.log(`[analyzeAll] Processing batch ${i / BATCH_SIZE + 1}, games:`, batch.map(g => g.id));

        const results = await Promise.allSettled(
          batch.map(game =>
            fetch("/api/analysis/single", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gameId: game.id })
            }).then(res => res.json())
          )
        );

        console.log(`[analyzeAll] Batch results:`, results.map((r, idx) => ({
          gameId: batch[idx].id,
          status: r.status,
          value: r.status === "fulfilled" ? r.value : null,
          reason: r.status === "rejected" ? r.reason : null
        })));

        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            analyzed++;
          } else {
            failed++;
            console.log("[analyzeAll] Failed result:", result);
            if (result.status === "fulfilled" && result.value.limitReached) {
              console.log("[analyzeAll] Limit reached during batch!");
              setRetentionLimitReached(true);
              toast.error("Free analysis limit reached");
              abortRef.current = true;
              break;
            }
          }
        }

        console.log(`[analyzeAll] After batch: analyzed=${analyzed}, failed=${failed}`);
        setAnalyzeProgress({
          current: startingCount + analyzed + failed,
          total: startingCount + totalToAnalyze
        });

        // Refresh analyses list periodically
        if ((i + BATCH_SIZE) % 40 === 0 || i + BATCH_SIZE >= unanalyzedGames.length) {
          fetchAnalyses();
        }
      }

      console.log(`[analyzeAll] Finished! analyzed=${analyzed}, failed=${failed}, aborted=${abortRef.current}`);
      if (!abortRef.current) {
        toast.success(`Analysis complete! ${analyzed} games analyzed.`);
      }

      // Final refresh
      await fetchAnalyses();
      await fetchStats();

    } catch (error) {
      console.error("[analyzeAll] Error:", error);
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const stopAnalysis = () => {
    abortRef.current = true;
  };

  if (authLoading || loading) {
    return <LoadingSpinner />;
  }

  if (selectedAnalysis) {
    return (
      <div>
        <button
          onClick={() => setSelectedAnalysis(null)}
          className="text-[#f44336] hover:text-[#f44336]/80 mb-6 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all analyses
        </button>

        <div className="bg-[#202020] border border-white/10 rounded-lg p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f5f5] mb-6">
            Game Analysis
          </h1>

          <div className="mb-8 space-y-2">
            <p className="text-[#b4b4b4] text-sm">
              Analyzed: <span className="text-[#f5f5f5]">{new Date(selectedAnalysis.analyzed_at).toLocaleString()}</span>
            </p>
            <p className="text-[#b4b4b4] text-sm">
              Blunders found: <span className="text-[#f44336] font-medium">{selectedAnalysis.blunders.length}</span>
            </p>
            <p className="text-[#b4b4b4] text-sm">
              Threshold: <span className="text-[#f5f5f5]">{selectedAnalysis.threshold_cp} centipawns</span>
            </p>
          </div>

          {selectedAnalysis.blunders.length === 0 ? (
            <div className="bg-[#18be5d]/10 border border-[#18be5d]/30 rounded-md p-6 text-center">
              <p className="text-[#18be5d]">
                No blunders found in this game. Great play!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#f5f5f5]">Blunders</h2>
              {selectedAnalysis.blunders.map((blunder: Blunder, index: number) => (
                <div
                  key={index}
                  className="bg-[#3c3c3c]/50 border border-white/10 rounded-md p-4 hover:border-white/20 transition-colors"
                >
                  <div className="flex gap-4 items-center">
                    <div className="flex-shrink-0">
                      <BoardPreview fen={blunder.fen} size={100} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-[#f5f5f5]">Move {blunder.move_number}</span>
                        <span className="text-[#f44336] font-semibold text-sm">
                          -{blunder.eval_drop} cp
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-[#b4b4b4]">
                          Played: <span className="font-mono text-[#f44336]">{blunder.move_played}</span>
                        </p>
                        <p className="text-sm text-[#b4b4b4]">
                          Best: <span className="font-mono text-[#18be5d]">{blunder.best_move}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() =>
                          router.push(
                            `/practice?analysisId=${selectedAnalysis.id}&blunderIndex=${index}&clearFilters=true`
                          )
                        }
                        className="inline-flex items-center justify-center rounded-md bg-[#18be5d] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#18be5d]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18be5d] transition-all"
                      >
                        Practice
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">Analysis</h1>
        <div className="flex gap-3">
          {analyzing && (
            <button
              onClick={stopAnalysis}
              className="inline-flex items-center justify-center rounded-md bg-[#f44336] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#f44336]/90 transition-all"
            >
              Stop
            </button>
          )}
          <button
            onClick={analyzeAll}
            disabled={analyzing || stats.totalGames === stats.analyzedGames || retentionLimitReached}
            className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#202020] border-t-transparent rounded-full animate-spin mr-2" />
                Analyzing...
              </>
            ) : retentionLimitReached ? (
              "Limit Reached"
            ) : stats.totalGames === stats.analyzedGames ? (
              "All Analyzed"
            ) : stats.analyzedGames > 0 ? (
              "Analyze Remaining Games"
            ) : (
              "Analyze All Games"
            )}
          </button>
        </div>
      </div>

      {analyzing && (
        <div className="bg-[#202020] border border-white/10 rounded-lg p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[#f5f5f5] text-sm font-medium">
              Analyzing games... Keep this page open.
            </p>
            <p className="text-[#b4b4b4] text-sm">
              {analyzeProgress.current}/{analyzeProgress.total}
            </p>
          </div>
          <div className="bg-[#3c3c3c] rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#f44336] to-[#ff6f00] h-2 rounded-full transition-all duration-300"
              style={{
                width: analyzeProgress.total > 0
                  ? `${(analyzeProgress.current / analyzeProgress.total) * 100}%`
                  : "0%"
              }}
            />
          </div>
          <p className="text-[#b4b4b4] text-xs mt-2">
            Processing {BATCH_SIZE} games at a time. You can stop and resume anytime.
          </p>
        </div>
      )}

      {retentionLimitReached && !stats.isPremium && (
        <div className="bg-[#f44336]/10 border border-[#f44336]/30 rounded-lg p-5 mb-8">
          <p className="text-[#f5f5f5] font-medium mb-2">
            You&apos;ve analyzed {stats.analyzedGames} games (free limit: {stats.retentionLimit})
          </p>
          <p className="text-[#b4b4b4] text-sm mb-4">
            To analyze more games and grow your blunder library:
          </p>
          <a
            href="/account"
            className="inline-block bg-[#18be5d] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#18be5d]/90 transition-colors"
          >
            Upgrade to Premium - $4.99/mo
          </a>
          <ul className="mt-4 space-y-1 text-sm text-[#b4b4b4]">
            <li>- Analyze up to 1,000 games at a time</li>
            <li>- Unlimited game retention</li>
            <li>- Higher analysis depth (up to 25)</li>
          </ul>
        </div>
      )}

      <div className={`grid gap-4 sm:gap-6 mb-8 ${!stats.isPremium ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatCard label="Total Games" value={analyzing ? analyzeProgress.total : stats.totalGames} />
        <StatCard
          label="Analyzed"
          value={analyzing ? analyzeProgress.current : stats.analyzedGames}
          sublabel={`${(analyzing ? analyzeProgress.total : stats.totalGames) > 0 ? Math.round(((analyzing ? analyzeProgress.current : stats.analyzedGames) / (analyzing ? analyzeProgress.total : stats.totalGames)) * 100) : 0}%`}
          valueColor="text-[#18be5d]"
        />
        {!stats.isPremium && stats.retentionLimit && (
          <StatCard
            label="Analysis Limit"
            value={`${analyzing ? analyzeProgress.current : stats.analyzedGames}/${stats.retentionLimit}`}
            sublabel={retentionLimitReached ? "Limit reached" : `${stats.retentionLimit - (analyzing ? analyzeProgress.current : stats.analyzedGames)} remaining`}
            valueColor={retentionLimitReached ? "text-[#f44336]" : "text-[#ff6f00]"}
          />
        )}
      </div>

      {analyses.length === 0 ? (
        <div className="bg-[#202020] border border-white/10 rounded-lg p-12 text-center">
          <div className="w-16 h-16 rounded-lg bg-[#3c3c3c] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#b4b4b4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[#b4b4b4] mb-2">
            No games analyzed yet
          </p>
          <p className="text-[#b4b4b4]/70 text-sm">
            Click &quot;Analyze All Games&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {analyses.map((analysis) => {
            const game = analysis.game;
            const isWin = game?.result === 'win';
            const isLoss = ['resigned', 'checkmated', 'timeout', 'abandoned', 'loss'].includes(game?.result || '');
            const isDraw = ['repetition', 'stalemate', 'agreed', 'insufficient', '50move', 'draw'].includes(game?.result || '');

            return (
              <div
                key={analysis.id}
                className="bg-[#202020] border border-white/10 rounded-lg p-4 cursor-pointer hover:border-white/20 hover:bg-[#3c3c3c]/30 transition-all"
                onClick={() => setSelectedAnalysis(analysis)}
              >
                {/* Mobile Layout */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${game?.user_color === 'white' ? 'bg-white' : 'bg-gray-800 border border-gray-600'}`} />
                      <span className="font-medium text-[#f5f5f5] truncate max-w-[140px]">
                        {game?.opponent || 'Unknown'}
                      </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      isWin ? 'bg-[#18be5d]/20 text-[#18be5d]' :
                      isLoss ? 'bg-[#f44336]/20 text-[#f44336]' :
                      'bg-[#808080]/20 text-[#808080]'
                    }`}>
                      {isWin ? 'Win' : isLoss ? 'Loss' : isDraw ? 'Draw' : '?'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#b4b4b4] mb-2">
                    <span className="capitalize">{game?.time_class || 'Unknown'}</span>
                    <span>•</span>
                    <span>{game?.played_at ? new Date(game.played_at).toLocaleDateString() : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${analysis.blunders.length > 0 ? 'text-[#ff6f00]' : 'text-[#18be5d]'}`}>
                      {analysis.blunders.length} blunder{analysis.blunders.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[#f5f5f5] text-xs font-medium inline-flex items-center gap-1">
                      View
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-4">
                  {/* Color indicator */}
                  <span className={`w-4 h-4 rounded-full flex-shrink-0 ${game?.user_color === 'white' ? 'bg-white' : 'bg-gray-800 border border-gray-600'}`} />

                  {/* Opponent & Result */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#f5f5f5] truncate">
                        vs {game?.opponent || 'Unknown'}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
                        isWin ? 'bg-[#18be5d]/20 text-[#18be5d]' :
                        isLoss ? 'bg-[#f44336]/20 text-[#f44336]' :
                        'bg-[#808080]/20 text-[#808080]'
                      }`}>
                        {isWin ? 'Win' : isLoss ? 'Loss' : isDraw ? 'Draw' : '?'}
                      </span>
                    </div>
                  </div>

                  {/* Time class */}
                  <div className="text-sm text-[#b4b4b4] capitalize w-16 text-center flex-shrink-0">
                    {game?.time_class || '-'}
                  </div>

                  {/* Date */}
                  <div className="text-sm text-[#b4b4b4] w-24 text-center flex-shrink-0">
                    {game?.played_at ? new Date(game.played_at).toLocaleDateString() : '-'}
                  </div>

                  {/* Blunders */}
                  <div className={`text-sm font-medium w-20 text-center flex-shrink-0 ${
                    analysis.blunders.length > 0 ? 'text-[#ff6f00]' : 'text-[#18be5d]'
                  }`}>
                    {analysis.blunders.length} blunder{analysis.blunders.length !== 1 ? 's' : ''}
                  </div>

                  {/* View button */}
                  <span className="text-[#f5f5f5] text-sm font-medium inline-flex items-center gap-1 flex-shrink-0">
                    View
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AnalysisContent />
    </Suspense>
  );
}
