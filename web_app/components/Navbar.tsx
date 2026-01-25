"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-zinc-950/60 border-b border-white/10">
      <nav className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-white hover:text-sky-400 transition-colors">
            ChessBlunders.org
          </Link>

          <div className="flex items-center gap-6">
            {loading ? (
              <span className="text-slate-400 text-sm">Loading...</span>
            ) : user ? (
              <>
                <Link href="/games" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                  Games
                </Link>
                <Link href="/analysis" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                  Analysis
                </Link>
                <Link href="/practice" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                  Practice
                </Link>
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                  <span className="text-sm text-slate-400">
                    {profile?.chess_username || user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
