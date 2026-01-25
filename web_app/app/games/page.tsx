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
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Your Games</h1>

        <div className="flex items-center gap-4">
          <select
            value={importDuration}
            onChange={(e) => setImportDuration(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
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
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium"
          >
            {importing ? "Importing..." : "Import Games"}
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">
            No games imported yet. Select a time range and click &quot;Import Games&quot; to
            get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opponent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Control
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {games.map((game) => (
                <tr key={game.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.played_at
                      ? new Date(game.played_at).toLocaleDateString()
                      : "Unknown"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.opponent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        game.user_color === "white"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-gray-800 text-white"
                      }`}
                    >
                      {game.user_color}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {game.result}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
