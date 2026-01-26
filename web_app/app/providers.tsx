"use client";

import { AuthProvider } from "@/lib/auth-context";
import { UsernameGuard } from "@/components/UsernameGuard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UsernameGuard>{children}</UsernameGuard>
    </AuthProvider>
  );
}
