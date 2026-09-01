"use client";

import { useEffect } from "react";

const RETRY_KEY = "chessblunders_coi_retry";

/**
 * Guarantees the page is cross-origin isolated, which the Stockfish WASM engine
 * requires.
 *
 * `crossOriginIsolated` is decided when the *document* loads, and the COOP/COEP
 * headers that grant it are scoped to the engine routes (see next.config.ts) —
 * so they only attach to a real document fetch. Arriving by client-side
 * navigation from a page without those headers (the homepage, the games list)
 * leaves the flag false and the engine refuses to start.
 *
 * One hard reload of the same URL picks the headers up. Call this at the very
 * top of a page component: it fires on mount, before the user has interacted,
 * so a reload costs nothing but the load itself. The sessionStorage guard means
 * a genuinely misconfigured deploy surfaces the engine's own error instead of
 * reload-looping.
 */
export function useCrossOriginIsolationReload() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.crossOriginIsolated) {
      // Clear the guard so a later tab-session failure still gets its one retry.
      sessionStorage.removeItem(RETRY_KEY);
      return;
    }
    if (sessionStorage.getItem(RETRY_KEY)) return;
    sessionStorage.setItem(RETRY_KEY, "1");
    window.location.reload();
  }, []);
}
