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
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (selectedAnalysis) {
    return (
      <div>
        <button
          onClick={() => setSelectedAnalysis(null)}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          Back to all analyses
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Game Analysis
          </h1>

          <div className="mb-6">
            <p className="text-gray-600">
              Analyzed: {new Date(selectedAnalysis.analyzed_at).toLocaleString()}
            </p>
            <p className="text-gray-600">
              Blunders found: {selectedAnalysis.blunders.length}
            </p>
            <p className="text-gray-600">
              Threshold: {selectedAnalysis.threshold_cp} centipawns
            </p>
          </div>

          {selectedAnalysis.blunders.length === 0 ? (
            <p className="text-gray-600">
              No blunders found in this game. Great play!
            </p>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Blunders</h2>
              {selectedAnalysis.blunders.map((blunder: Blunder, index: number) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Move {blunder.move_number}</p>
                      <p className="text-sm text-gray-600">
                        Played: <span className="font-mono">{blunder.move_played}</span>
                      </p>
                      <p className="text-sm text-green-600">
                        Best: <span className="font-mono">{blunder.best_move}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-600 font-medium">
                        -{blunder.eval_drop} cp
                      </p>
                      <button
                        onClick={() =>
                          router.push(
                            `/practice?analysisId=${selectedAnalysis.id}&blunderIndex=${index}`
                          )
                        }
                        className="mt-2 text-sm bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded"
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Analysis</h1>
        <button
          onClick={analyzeAll}
          disabled={analyzing || stats.totalGames === stats.analyzedGames}
          className="bg-green-600 hover:bg-green-500 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium"
        >
          {analyzing
            ? `Analyzing ${analyzeProgress.current}/${analyzeProgress.total}...`
            : "Analyze All Games"}
        </button>
      </div>

      {analyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            Analysis is running in the background. You can close this page and come back later.
          </p>
          <div className="mt-2 bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: analyzeProgress.total > 0
                  ? `${(analyzeProgress.current / analyzeProgress.total) * 100}%`
                  : "0%"
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wider">Total Games</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalGames}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 uppercase tracking-wider">Analyzed</p>
          <p className="text-3xl font-bold text-green-600">
            {stats.analyzedGames}
            <span className="text-lg text-gray-400 ml-2">
              ({stats.totalGames > 0 ? Math.round((stats.analyzedGames / stats.totalGames) * 100) : 0}%)
            </span>
          </p>
        </div>
      </div>

      {analyses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">
            No games analyzed yet. Click &quot;Analyze All Games&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedAnalysis(analysis)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(analysis.analyzed_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    {analysis.blunders.length} blunders found
                  </p>
                </div>
                <span className="text-blue-600">View details</span>
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
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
