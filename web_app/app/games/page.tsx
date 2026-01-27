"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Game } from "@/lib/supabase";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { GamesTable } from "@/components/GamesTable";

export default function GamesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState("50");
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchGames();
      fetchPremiumStatus();
    }
  }, [user]);

  const fetchPremiumStatus = async () => {
    try {
      const response = await fetch("/api/user");
      const data = await response.json();
      if (data.user) {
        const status = data.user.stripe_subscription_status;
        const periodEnd = data.user.subscription_period_end;
        setIsPremium(
          status === "active" ||
          status === "trialing" ||
          (status === "canceled" && periodEnd && new Date(periodEnd) > new Date())
        );
      }
    } catch (error) {
      console.error("Error fetching premium status:", error);
    }
  };

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
        body: JSON.stringify({ count: importCount === "all" ? "all" : parseInt(importCount) }),
      });

      const data = await response.json();
      if (response.ok) {
        let message = `Imported ${data.imported} new games out of ${data.total} fetched`;
        if (data.limited) {
          message += ` (limited to ${data.maxFreeGames} for free accounts)`;
        }
        toast.success(message);
        fetchGames();
      } else if (data.upgrade) {
        toast.error(
          <div>
            <p>{data.error}</p>
            <a href="/account" className="underline text-[#f44336]">Upgrade to Premium</a>
          </div>
        );
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
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5] mb-4">Your Games</h1>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-3">
          <select
            value={importCount}
            onChange={(e) => setImportCount(e.target.value)}
            className="flex-1 sm:flex-none bg-[#3c3c3c]/30 border border-white/10 rounded-md pl-4 pr-8 py-2.5 text-sm text-[#b4b4b4] focus:outline-none focus:ring-2 focus:ring-[#f44336] focus:border-transparent transition-all"
          >
            <option value="25" className="bg-[#2a2a2a] text-[#f5f5f5]">Last 25 games</option>
            <option value="50" className="bg-[#2a2a2a] text-[#f5f5f5]">Last 50 games</option>
            <option value="100" className="bg-[#2a2a2a] text-[#f5f5f5]">Last 100 games</option>
            <option value="250" disabled={!isPremium} className={`bg-[#2a2a2a] ${isPremium ? "text-[#f5f5f5]" : "text-[#707070]"}`}>
              Last 250 games {!isPremium && "(Premium)"}
            </option>
            <option value="500" disabled={!isPremium} className={`bg-[#2a2a2a] ${isPremium ? "text-[#f5f5f5]" : "text-[#707070]"}`}>
              Last 500 games {!isPremium && "(Premium)"}
            </option>
            <option value="1000" disabled={!isPremium} className={`bg-[#2a2a2a] ${isPremium ? "text-[#f5f5f5]" : "text-[#707070]"}`}>
              Last 1000 games {!isPremium && "(Premium)"}
            </option>
          </select>
          <button
            onClick={importGames}
            disabled={importing}
            className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#202020] border-t-transparent rounded-full animate-spin mr-2" />
                Importing...
              </>
            ) : (
              "Import"
            )}
          </button>
        </div>
        {games.length > 0 && (
          <Link
            href="/analysis"
            className="inline-flex items-center justify-center rounded-md bg-[#f44336] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#f44336]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f44336] transition-all w-full sm:w-auto"
          >
            Analyze
          </Link>
        )}
      </div>

      <GamesTable games={games} />
    </div>
  );
}
