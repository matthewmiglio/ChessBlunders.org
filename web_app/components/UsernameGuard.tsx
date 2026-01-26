"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { UsernamePrompt } from "./UsernamePrompt";

export function UsernameGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  useEffect(() => {
    if (!loading && user && profile && !profile.chess_username) {
      setShowUsernamePrompt(true);
    } else {
      setShowUsernamePrompt(false);
    }
  }, [user, profile, loading]);

  const handleSetUsername = async (username: string) => {
    const response = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chessUsername: username }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to set username");
    }

    await refreshProfile();
    setShowUsernamePrompt(false);
    router.push("/games");
  };

  return (
    <>
      {showUsernamePrompt && <UsernamePrompt onSubmit={handleSetUsername} />}
      {children}
    </>
  );
}
