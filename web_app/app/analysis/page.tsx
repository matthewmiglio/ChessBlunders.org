"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Analysis, Blunder } from "@/lib/supabase";
import { toast } from "sonner";

function AnalysisContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("id");

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalGames: 0, analyzedGames: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchAnalyses();
      fetchStats();
      checkJobStatus();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
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
      setStats(data);
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

  const checkJobStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/analysis/status");
      const data = await response.json();

      if (data.hasJob && (data.status === "running" || data.status === "pending")) {
        setAnalyzing(true);
        setAnalyzeProgress({ current: data.current, total: data.total });
        startPolling();
      } else if (data.hasJob && data.status === "completed") {
        setAnalyzing(false);
        setAnalyzeProgress({ current: 0, total: 0 });
      }
    } catch (error) {
      console.error("Error checking job status:", error);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch("/api/analysis/status");
        const data = await response.json();

        if (data.hasJob) {
          setAnalyzeProgress({ current: data.current, total: data.total });

          if (data.status === "completed") {
            setAnalyzing(false);
            setAnalyzeProgress({ current: 0, total: 0 });
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.success(`Analysis complete! ${data.current} games analyzed.`);
            fetchAnalyses();
            fetchStats();
          } else if (data.status === "failed") {
            setAnalyzing(false);
            setAnalyzeProgress({ current: 0, total: 0 });
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast.error(`Analysis failed: ${data.error || "Unknown error"}`);
          }
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    }, 2000);
  }, []);

  const analyzeAll = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/analysis/all", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        if (data.message === "All games already analyzed") {
          toast.info("All games are already analyzed!");
          setAnalyzing(false);
          return;
        }

        setAnalyzeProgress({ current: data.current || 0, total: data.total || 0 });
        toast.success("Analysis started! You can close this page - it will continue in the background.");
        startPolling();
      } else {
        toast.error(data.error || "Failed to start analysis");
        setAnalyzing(false);
      }
    } catch (error) {
      console.error("Error analyzing games:", error);
      toast.error("Failed to start analysis");
      setAnalyzing(false);
    }
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

  if (selectedAnalysis) {
    return (
      <div>
        <button
          onClick={() => setSelectedAnalysis(null)}
          className="text-sky-400 hover:text-sky-300 mb-6 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all analyses
        </button>

        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-6">
            Game Analysis
          </h1>

          <div className="mb-8 space-y-2">
            <p className="text-slate-400 text-sm">
              Analyzed: <span className="text-slate-300">{new Date(selectedAnalysis.analyzed_at).toLocaleString()}</span>
            </p>
            <p className="text-slate-400 text-sm">
              Blunders found: <span className="text-sky-400 font-medium">{selectedAnalysis.blunders.length}</span>
            </p>
            <p className="text-slate-400 text-sm">
              Threshold: <span className="text-slate-300">{selectedAnalysis.threshold_cp} centipawns</span>
            </p>
          </div>

          {selectedAnalysis.blunders.length === 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <p className="text-emerald-400">
                No blunders found in this game. Great play!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Blunders</h2>
              {selectedAnalysis.blunders.map((blunder: Blunder, index: number) => (
                <div
                  key={index}
                  className="bg-slate-800/50 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">Move {blunder.move_number}</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Played: <span className="font-mono text-red-400">{blunder.move_played}</span>
                      </p>
                      <p className="text-sm text-slate-400">
                        Best: <span className="font-mono text-emerald-400">{blunder.best_move}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-semibold text-lg">
                        -{blunder.eval_drop} cp
                      </p>
                      <button
                        onClick={() =>
                          router.push(
                            `/practice?analysisId=${selectedAnalysis.id}&blunderIndex=${index}`
                          )
                        }
                        className="mt-3 inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-all"
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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Analysis</h1>
        <button
          onClick={analyzeAll}
          disabled={analyzing || stats.totalGames === stats.analyzedGames}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {analyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Analyzing {analyzeProgress.current}/{analyzeProgress.total}...
            </>
          ) : (
            "Analyze All Games"
          )}
        </button>
      </div>

      {analyzing && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-5 mb-8">
          <p className="text-sky-400 text-sm mb-3">
            Analysis is running in the background. You can close this page and come back later.
          </p>
          <div className="bg-sky-950 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-400 to-sky-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: analyzeProgress.total > 0
                  ? `${(analyzeProgress.current / analyzeProgress.total) * 100}%`
                  : "0%"
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total Games</p>
          <p className="text-3xl font-semibold text-white">{stats.totalGames}</p>
        </div>
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Analyzed</p>
          <p className="text-3xl font-semibold text-emerald-400">
            {stats.analyzedGames}
            <span className="text-lg text-slate-500 ml-2 font-normal">
              ({stats.totalGames > 0 ? Math.round((stats.analyzedGames / stats.totalGames) * 100) : 0}%)
            </span>
          </p>
        </div>
      </div>

      {analyses.length === 0 ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-slate-400 mb-2">
            No games analyzed yet
          </p>
          <p className="text-slate-500 text-sm">
            Click &quot;Analyze All Games&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="bg-slate-900/50 border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-white/20 hover:bg-slate-800/50 transition-all"
              onClick={() => setSelectedAnalysis(analysis)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-white">
                    {new Date(analysis.analyzed_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    <span className={analysis.blunders.length > 0 ? "text-amber-400" : "text-emerald-400"}>
                      {analysis.blunders.length}
                    </span> blunders found
                  </p>
                </div>
                <span className="text-sky-400 text-sm font-medium inline-flex items-center gap-1">
                  View details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
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
      <AnalysisContent />
    </Suspense>
  );
}
