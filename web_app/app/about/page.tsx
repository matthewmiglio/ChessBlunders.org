import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About ChessBlunders - Analyze Games & Practice Your Mistakes",
  description:
    "ChessBlunders uses Stockfish 16 to analyze your chess games, find your blunders, and turn them into puzzles. Train on your actual mistakes to improve faster.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About ChessBlunders - Analyze Games & Practice Your Mistakes",
    description:
      "ChessBlunders uses Stockfish 16 to analyze your chess games, find your blunders, and turn them into puzzles. Train on your actual mistakes to improve faster.",
    url: "https://chessblunders.org/about",
    siteName: "ChessBlunders.org",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "About ChessBlunders - Analyze Games & Practice Your Mistakes",
    description:
      "Stockfish 16 analyzes your chess games to find blunders. Practice them as puzzles to improve faster.",
  },
};

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#141414] via-[#1a1a1a] to-[#141414]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-24 py-8 sm:py-12">
        {/* Hero Section */}
        <section className="space-y-8">
          <div className="relative h-[300px] sm:h-[400px] rounded-xl overflow-hidden">
            <Image
              src="/high-res/photo-1529699211952-734e80c4d42b.avif"
              alt="Close-up of chess pieces on a wooden board representing strategic chess training"
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#f5f5f5]">
                About{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f44336] to-[#ff6f00]">
                  ChessBlunders
                </span>
              </h1>
            </div>
          </div>
        </section>

        {/* What is ChessBlunders Section */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
              What is ChessBlunders?
            </h2>
            <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
          </div>

          <div className="space-y-6">
            <p className="text-lg sm:text-xl text-[#b4b4b4] leading-relaxed">
              ChessBlunders is a training tool that analyzes your actual chess
              games to find the{" "}
              <span className="text-[#f5f5f5] font-medium">
                specific mistakes you make
              </span>
              , then turns those positions into puzzles you can practice.
              Instead of solving random tactics, you train on the exact patterns
              where you went wrong.
            </p>

            <p className="text-lg sm:text-xl text-[#b4b4b4] leading-relaxed">
              Powered by{" "}
              <span className="text-[#f5f5f5] font-medium">Stockfish 16</span>,
              the strongest chess engine in the world, every game you import
              gets deep analysis to identify blunders, mistakes, and missed
              opportunities. Then you practice finding the right moves until
              those patterns become automatic.
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
              How It Works
            </h2>
            <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Import Your Games",
                description:
                  "Connect your Chess.com account and import your recent games with one click.",
              },
              {
                step: "2",
                title: "Analyze with Stockfish",
                description:
                  "Every game is analyzed by Stockfish 16 to find your blunders and mistakes.",
              },
              {
                step: "3",
                title: "Practice Your Blunders",
                description:
                  "Solve your blunders as puzzles. Find the move you should have played.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-[#202020] border border-white/10 rounded-lg p-6 space-y-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[#f44336]/20 flex items-center justify-center">
                  <span className="text-[#f44336] font-semibold">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[#f5f5f5]">
                  {item.title}
                </h3>
                <p className="text-[#b4b4b4] text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Philosophy Section */}
        <section className="space-y-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="relative h-[300px] sm:h-[400px] rounded-xl overflow-hidden order-2 md:order-1">
              <Image
                src="/high-res/photo-1580541832626-2a7131ee809f.avif"
                alt="Chess pieces in strategic position illustrating pattern recognition and game analysis"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/60 via-transparent to-transparent" />
            </div>

            <div className="space-y-6 order-1 md:order-2">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
                  The Philosophy
                </h2>
                <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
              </div>

              <p className="text-lg text-[#b4b4b4] leading-relaxed">
                Most chess improvement platforms throw random puzzles at you.
                The problem? Those puzzles might not address{" "}
                <span className="text-[#f5f5f5] font-medium">
                  your specific weaknesses
                </span>
                .
              </p>

              <p className="text-lg text-[#b4b4b4] leading-relaxed">
                ChessBlunders takes a different approach:{" "}
                <span className="text-[#f5f5f5] font-medium">
                  learn from your own games
                </span>
                . Every blunder you make is a lesson waiting to be learned. By
                practicing those exact positions, you build pattern recognition
                for the situations you actually encounter in your games.
              </p>

              <p className="text-[#b4b4b4]/80">
                No ads, no distractions - just focused training on the mistakes
                that matter.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
              Features
            </h2>
            <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                ),
                title: "Stockfish 16 Analysis",
                description:
                  "The strongest chess engine analyzes every move in your games.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                ),
                title: "Progress Tracking",
                description:
                  "Track your improvement with detailed statistics and streaks.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                ),
                title: "Practice Runs",
                description:
                  "Complete practice runs through all your blunders, then start fresh.",
              },
              {
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ),
                title: "Chess.com Integration",
                description:
                  "Import games directly from your Chess.com account in seconds.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 p-4 bg-[#202020]/50 border border-white/5 rounded-lg hover:border-white/10 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#3c3c3c] flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#f44336]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-[#f5f5f5] mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#b4b4b4]">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center space-y-8 pb-8">
          <div className="bg-[#202020] border border-white/10 rounded-xl p-8 sm:p-12 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#f5f5f5]">
              Ready to improve?
            </h2>
            <p className="text-[#b4b4b4] max-w-lg mx-auto">
              Start analyzing your games and turn your blunders into lessons.
              Free to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-md bg-[#ebebeb] px-8 py-3.5 text-base font-medium text-[#202020] shadow-sm hover:bg-[#ebebeb]/90 transition-all"
              >
                Get Started
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-[#3c3c3c] border border-white/10 px-8 py-3.5 text-base font-medium text-[#f5f5f5] hover:bg-[#3c3c3c]/80 transition-all"
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
