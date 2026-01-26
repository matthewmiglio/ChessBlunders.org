"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#141414]/80 border-b border-white/10">
      <nav className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-[#f5f5f5] hover:text-[#f44336] transition-colors">
            ChessBlunders.org
          </Link>

          <div className="flex items-center gap-6">
            {loading ? (
              <span className="text-[#b4b4b4] text-sm">Loading...</span>
            ) : user ? (
              <>
                <Link href="/games" className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium">
                  Games
                </Link>
                <Link href="/analysis" className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium">
                  Analysis
                </Link>
                <Link href="/practice" className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium">
                  Practice
                </Link>
                <Link href="/progress" className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium">
                  Progress
                </Link>
                <Link href="/account" className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium">
                  Account
                </Link>
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                  <span className="text-sm text-[#b4b4b4]">
                    {profile?.chess_username || user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm text-[#b4b4b4] hover:text-[#f5f5f5] px-3 py-1.5 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-4 py-2 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8c8c8c] transition-all"
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
