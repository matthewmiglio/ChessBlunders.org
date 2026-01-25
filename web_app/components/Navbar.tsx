"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <nav className="bg-gray-900 text-white px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          ChessBlunders.org
        </Link>

        <div className="flex items-center gap-6">
          {loading ? (
            <span className="text-gray-400">Loading...</span>
          ) : user ? (
            <>
              <Link href="/games" className="hover:text-gray-300">
                Games
              </Link>
              <Link href="/analysis" className="hover:text-gray-300">
                Analysis
              </Link>
              <Link href="/practice" className="hover:text-gray-300">
                Practice
              </Link>
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-700">
                <span className="text-sm text-gray-400">
                  {profile?.chess_username || user.email}
                </span>
                <button
                  onClick={signOut}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <Link
              href="/auth/signin"
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
