"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function getOrCreateId(key: string): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let id = sessionStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("session_id", id);
  }
  return id;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Skip if same path (avoid double tracking)
    if (lastPath.current === pathname) {
      return;
    }
    lastPath.current = pathname;

    const visitorId = getOrCreateId("visitor_id");
    const sessionId = getSessionId();

    const payload = {
      path: pathname,
      referrer: document.referrer || null,
      visitorId,
      sessionId,
    };

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
