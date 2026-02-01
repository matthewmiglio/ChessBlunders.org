import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - ChessBlunders",
  description:
    "Sign in to ChessBlunders to analyze your chess games with Stockfish 16 and practice your blunders as puzzles.",
  alternates: {
    canonical: "/auth/signin",
  },
  openGraph: {
    title: "Sign In - ChessBlunders",
    description:
      "Sign in to ChessBlunders to analyze your chess games and practice your blunders.",
    url: "https://chessblunders.org/auth/signin",
    siteName: "ChessBlunders.org",
    type: "website",
  },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
