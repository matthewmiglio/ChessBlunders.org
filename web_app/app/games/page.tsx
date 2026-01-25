"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Game } from "@/lib/supabase";
import { toast } from "sonner";

export default function GamesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importDuration, setImportDuration] = useState("1");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user]);

  const fetchGames = async () => {
    try {
      const response = await fetch("/api/games");
      const data = await response.json();
      setGames(data.games || []);
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  const importGames = async () => {
    setImporting(true);
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: importDuration === "all" || importDuration === "week" ? importDuration : parseInt(importDuration) }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`Imported ${data.imported} new games out of ${data.total} total`);
        fetchGames();
      } else {
        toast.error(data.error || "Failed to import games");
      }
    } catch (error) {
      console.error("Error importing games:", error);
      toast.error("Failed to import games");
    } finally {
      setImporting(false);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Your Games</h1>

        <div className="flex items-center gap-3">
          <select
            value={importDuration}
            onChange={(e) => setImportDuration(e.target.value)}
            className="bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
          >
            <option value="week">Last week</option>
            <option value="1">Last month</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last year</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={importGames}
            disabled={importing}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-sky-400 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Importing...
              </>
            ) : (
              "Import Games"
            )}
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-slate-400 mb-2">
            No games imported yet
          </p>
          <p className="text-slate-500 text-sm">
            Select a time range and click &quot;Import Games&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Opponent
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Time Control
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {games.map((game) => (
                <tr key={game.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    {game.played_at
                      ? new Date(game.played_at).toLocaleDateString()
                      : "Unknown"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                    {game.opponent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                        game.user_color === "white"
                          ? "bg-slate-200 text-slate-900"
                          : "bg-slate-700 text-slate-100"
                      }`}
                    >
                      {game.user_color}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${
                      game.result === "win" ? "text-emerald-400" :
                      game.result === "loss" ? "text-red-400" :
                      "text-slate-400"
                    }`}>
                      {game.result}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {game.time_class}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
