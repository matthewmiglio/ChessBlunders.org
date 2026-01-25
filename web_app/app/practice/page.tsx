"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { Analysis, Blunder } from "@/lib/supabase";

interface UserStats {
  total_games: number;
  analyzed_games: number;
  total_blunders: number;
  solved_blunders: number;
  total_attempts: number;
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
  const [userMove, setUserMove] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const pickRandomBlunder = (availableAnalyses: Analysis[]) => {
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
    setUserMove("");
  };

  const checkMove = async () => {
    if (!currentBlunder || !currentAnalysisId) return;

    const isCorrect =
      userMove.toLowerCase().replace(/\s/g, "") ===
      currentBlunder.best_move.toLowerCase().replace(/\s/g, "");

    setFeedback({
      correct: isCorrect,
      message: isCorrect
        ? "Correct! That's the best move."
        : `Incorrect. The best move was ${currentBlunder.best_move}`,
    });

    // Record attempt
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: currentAnalysisId,
          blunderIndex: currentBlunderIndex,
          solved: isCorrect,
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const analysesWithBlunders = analyses.filter((a) => a.blunders.length > 0);

  if (analysesWithBlunders.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Practice Mode
        </h1>
        <p className="text-gray-600 mb-6">
          No blunders to practice yet. Analyze some games first!
        </p>
        <button
          onClick={() => router.push("/games")}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium"
        >
          Go to Games
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Practice Mode</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.total_blunders}
            </p>
            <p className="text-sm text-gray-600">Total Blunders</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {stats.solved_blunders}
            </p>
            <p className="text-sm text-gray-600">Solved</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.total_attempts}
            </p>
            <p className="text-sm text-gray-600">Total Attempts</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {stats.total_attempts > 0
                ? Math.round(
                    (stats.solved_blunders / stats.total_attempts) * 100
                  )
                : 0}
              %
            </p>
            <p className="text-sm text-gray-600">Success Rate</p>
          </div>
        </div>
      )}

      {currentBlunder && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">
              Find the best move
            </h2>
            <p className="text-gray-600">
              You played <span className="font-mono">{currentBlunder.move_played}</span> in
              this position. What should you have played instead?
            </p>
          </div>

          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <p className="font-mono text-sm break-all">{currentBlunder.fen}</p>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Evaluation dropped from {currentBlunder.eval_before} to{" "}
              {currentBlunder.eval_after} (lost {currentBlunder.eval_drop} cp)
            </p>
          </div>

          {!feedback && (
            <div className="flex gap-4">
              <input
                type="text"
                value={userMove}
                onChange={(e) => setUserMove(e.target.value)}
                placeholder="Enter your move (e.g., Nf3)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded"
                onKeyDown={(e) => e.key === "Enter" && checkMove()}
              />
              <button
                onClick={checkMove}
                disabled={!userMove.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white px-6 py-2 rounded font-medium"
              >
                Check
              </button>
            </div>
          )}

          {feedback && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg ${
                  feedback.correct
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {feedback.message}
              </div>
              <button
                onClick={nextBlunder}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium"
              >
                Next Blunder
              </button>
            </div>
          )}
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
          <p className="text-gray-600">Loading...</p>
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
