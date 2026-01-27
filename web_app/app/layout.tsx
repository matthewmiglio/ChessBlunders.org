import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Toaster } from "sonner";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChessBlunders.org - Learn From Your Chess Mistakes",
  description:
    "Analyze your chess games with Stockfish 16 to find blunders, then practice them as puzzles. Turn your mistakes into improvement.",
  metadataBase: new URL("https://chessblunders.org"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ChessBlunders.org - Learn From Your Chess Mistakes",
    description:
      "Analyze your chess games with Stockfish 16 to find blunders, then practice them as puzzles. Turn your mistakes into improvement.",
    url: "https://chessblunders.org",
    siteName: "ChessBlunders.org",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChessBlunders.org - Learn From Your Chess Mistakes",
    description:
      "Analyze your chess games with Stockfish 16 to find blunders, then practice them as puzzles.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} antialiased bg-[#141414] text-[#f5f5f5] min-h-screen`}
      >
        <Providers>
          <AnalyticsTracker />
          <Toaster position="top-right" theme="dark" richColors />
          <Navbar />
          <div className="flex flex-col min-h-screen">
            <main className="md:ml-72 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
