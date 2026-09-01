"""Black-box security regression test for the Supabase lockdown migration
(supabase/migrations/0001_security_lockdown.sql). Runs against PROD using ONLY
the public anon key — i.e. it plays the attacker. No auth, no browser.

Run this AFTER applying the migration + deploying, to confirm the holes stay
closed and the one legitimate anon capability (pageview tracking) still works.

Asserts:
  1. ChessPeckerPuzzles is gone (was RLS-off + full anon CRUD).
  2. get_feedback_list() is NOT callable by anon (was a PII dump).
  3. Admin RPCs (get_usage_summary, get_analytics_summary_all_time) are NOT
     callable by anon (dashboard uses service role).
  4. profiles / feedback / games are NOT readable by anon (no grant + RLS).
  5. Anonymous pageview tracking STILL works (anon can INSERT analytics) — the
     one privilege we deliberately kept.

Reads NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY from ../website/.env.local.
Usage:  poetry run python tests/test_supabase_security.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_PATH = os.path.join(ROOT, "..", "website", ".env.local")


def load_env() -> tuple[str, str]:
    url = key = None
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
            elif line.startswith("NEXT_PUBLIC_SUPABASE_ANON_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not url or not key:
        print(f"[sec] FAIL: could not read URL/ANON_KEY from {ENV_PATH}")
        sys.exit(2)
    return url.rstrip("/"), key


def req(method: str, url: str, key: str, body: dict | None = None,
        extra: dict | None = None) -> tuple[int, str]:
    """Return (status, body_text). Never raises on HTTP error status."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode()[:400]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]
    except Exception as e:  # noqa: BLE001
        return -1, str(e)[:400]


def main() -> None:
    base, key = load_env()
    rest = f"{base}/rest/v1"
    fails: list[str] = []

    def check(name: str, ok: bool, detail: str) -> None:
        print(f"[sec] {'PASS' if ok else 'FAIL'}: {name} — {detail}")
        if not ok:
            fails.append(name)

    # 1. Stray table dropped — must NOT return rows.
    s, b = req("GET", f"{rest}/ChessPeckerPuzzles?select=*&limit=1", key)
    check("ChessPeckerPuzzles removed", s != 200, f"HTTP {s}")

    # 2. Feedback dump RPC blocked for anon.
    s, b = req("POST", f"{rest}/rpc/get_feedback_list", key, body={})
    check("get_feedback_list blocked for anon", s != 200, f"HTTP {s}")

    # 3. Admin RPCs blocked for anon.
    for fn in ("get_usage_summary", "get_analytics_summary_all_time"):
        s, b = req("POST", f"{rest}/rpc/{fn}", key, body={})
        check(f"{fn} blocked for anon", s != 200, f"HTTP {s}")

    # 4. Sensitive tables unreadable by anon (no grant / RLS).
    for tbl in ("profiles", "feedback", "games"):
        s, b = req("GET", f"{rest}/{tbl}?select=id&limit=1", key)
        # 401 = permission denied (no grant). An empty 200 [] would also be
        # "safe" but means a grant still exists — we require no read at all.
        check(f"{tbl} not readable by anon", s == 401, f"HTTP {s}")

    # 5. Anonymous pageview tracking STILL works (the one kept anon privilege).
    s, b = req("POST", f"{rest}/analytics", key,
               body={"path": "/__sec_regression_test__"},
               extra={"Prefer": "return=minimal"})
    check("anon can still INSERT analytics (tracking)", s in (200, 201), f"HTTP {s}")

    print()
    if fails:
        print(f"[sec] {len(fails)} FAILED: {', '.join(fails)}")
        sys.exit(1)
    print("[sec] PASS: lockdown holds and pageview tracking still works.")


if __name__ == "__main__":
    main()
