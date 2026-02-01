"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSubscribed = profile?.stripe_subscription_status === 'active' || profile?.stripe_subscription_status === 'trialing';

  const navLinks = [
    { href: "/games", label: "Games" },
    { href: "/analysis", label: "Engine" },
    { href: "/practice", label: "Practice" },
    { href: "/progress", label: "Progress" },
    { href: "/account", label: isSubscribed ? "Subscription" : "Upgrade" },
    { href: "/feedback", label: "Feedback" },
  ];

  return (
    <>
      {/* Desktop Sidebar - Left vertical navigation */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 flex-col bg-[#141414] border-r border-white/10 z-50">
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/logos/chessblundericon.png" alt="ChessBlunders" width={34} height={34} sizes="34px" className="rounded" />
            <span className="font-[family-name:var(--font-cinzel)] text-2xl font-semibold text-[#f5f5f5] group-hover:text-[#f44336] transition-colors">
              Chess<span className="text-[#f44336]">Blunders</span>
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {loading ? (
            <span className="text-[#b4b4b4] text-sm px-3">Loading...</span>
          ) : user ? (
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-xl font-medium py-2.5 px-3 rounded-md"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/about"
                className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-xl font-medium py-2.5 px-3 rounded-md"
              >
                About
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                href="/auth/signin"
                className="block text-center rounded-md bg-[#ebebeb] px-4 py-2 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all mx-2"
              >
                Sign In
              </Link>
              <Link
                href="/about"
                className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-xl font-medium py-2.5 px-3 rounded-md"
              >
                About
              </Link>
            </div>
          )}
        </nav>

        {/* User section at bottom */}
        {user && !loading && (
          <div className="p-4 border-t border-white/10">
            <div className="text-sm text-[#b4b4b4] mb-2 truncate">
              {profile?.chess_username || user.email}
            </div>
            <button
              onClick={signOut}
              className="w-full text-sm text-[#b4b4b4] hover:text-[#f5f5f5] px-3 py-2 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Header - Horizontal top bar */}
      <header className="md:hidden sticky top-0 z-50 backdrop-blur-md bg-[#141414]/80 border-b border-white/10">
        <nav className="px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#f5f5f5] hover:text-[#f44336] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Image
                src="/logos/chessblundericon.png"
                alt="ChessBlunders"
                width={32}
                height={32}
                sizes="32px"
                className="rounded"
              />
              <span className="hidden sm:inline">Chess<span className="text-[#f44336]">Blunders</span>.org</span>
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              className="flex flex-col justify-center items-center w-10 h-10 rounded-md hover:bg-white/5 transition-colors"
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
            <div className="mt-4 pt-4 border-t border-white/10">
              {loading ? (
                <span className="text-[#b4b4b4] text-sm block py-2">Loading...</span>
              ) : user ? (
                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-base font-medium py-3 px-3 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Link
                    href="/about"
                    className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-base font-medium py-3 px-3 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    About
                  </Link>
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
                <div className="flex flex-col gap-2">
                  <Link
                    href="/auth/signin"
                    className="block text-center rounded-md bg-[#ebebeb] px-4 py-3 text-sm font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/about"
                    className="text-[#b4b4b4] hover:text-[#f5f5f5] hover:bg-white/5 transition-colors text-base font-medium py-3 px-3 rounded-md"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    About
                  </Link>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
