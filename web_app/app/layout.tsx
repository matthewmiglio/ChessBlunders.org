import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
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

export const metadata: Metadata = {
  title: "ChessBlunders.org",
  description: "Learn from your chess mistakes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#09090b] text-gray-200 min-h-screen`}
      >
        <Providers>
          <AnalyticsTracker />
          <Toaster position="top-right" theme="dark" richColors />
          <Navbar />
          <main className="max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
