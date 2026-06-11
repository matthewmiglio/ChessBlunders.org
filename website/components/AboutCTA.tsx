"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function AboutCTA() {
  const { user, loading } = useAuth();

  const href = loading ? "#" : user ? "/games" : "/auth/signin";

  return (
    <section className="text-center space-y-8 pb-8">
      <div className="sm:bg-[#202020] sm:border sm:border-white/10 sm:rounded-xl sm:p-12 space-y-6">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
          Ready to improve?
        </h2>
        <p className="text-[#b4b4b4] max-w-lg mx-auto">
          Start analyzing your games and turn your blunders into lessons.
          Free to get started.
        </p>
        <div className="flex justify-center">
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-8 py-3.5 text-base font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all"
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
