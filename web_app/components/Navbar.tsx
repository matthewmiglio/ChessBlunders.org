"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/games", label: "Games" },
    { href: "/analysis", label: "Analysis" },
    { href: "/practice", label: "Practice" },
    { href: "/progress", label: "Progress" },
    { href: "/account", label: "Account" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#141414]/80 border-b border-white/10">
      <nav className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-[#f5f5f5] hover:text-[#f44336] transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            ChessBlunders.org
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {loading ? (
              <span className="text-[#b4b4b4] text-sm">Loading...</span>
            ) : user ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors text-sm font-medium"
                  >
                    {link.label}
                  </Link>
                ))}
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

          {/* Mobile Hamburger Button */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-md hover:bg-white/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-0.5 bg-[#f5f5f5] transition-all duration-300 ${
                mobileMenuOpen ? "rotate-45 translate-y-1" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-[#f5f5f5] my-1 transition-all duration-300 ${
                mobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-[#f5f5f5] transition-all duration-300 ${
                mobileMenuOpen ? "-rotate-45 -translate-y-1" : ""
              }`}
            />
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/10">
            {loading ? (
              <span className="text-[#b4b4b4] text-sm block py-2">Loading...</span>
            ) : user ? (
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-sm font-medium py-3 px-3 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="px-3 py-2 text-sm text-[#b4b4b4]">
                    Signed in as <span className="text-[#f5f5f5]">{profile?.chess_username || user.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left text-sm text-[#f44336] hover:bg-white/5 px-3 py-3 rounded-md transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="block text-center rounded-md bg-[#ebebeb] px-4 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
