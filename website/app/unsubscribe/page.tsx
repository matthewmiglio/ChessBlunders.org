import type { Metadata } from "next";
import UnsubscribeForm from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Unsubscribe - ChessBlunders",
  robots: { index: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email = "", token = "" } = await searchParams;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#141414] sm:bg-gradient-to-b sm:from-[#141414] sm:via-[#1a1a1a] sm:to-[#141414]" />
      </div>

      <div className="max-w-xl mx-auto py-8 sm:py-12 px-4">
        <div className="space-y-4 mb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f5f5]">Unsubscribe</h1>
          <div className="w-20 h-px bg-gradient-to-r from-[#f44336] to-transparent" />
        </div>
        <UnsubscribeForm email={email} token={token} />
      </div>
    </div>
  );
}
