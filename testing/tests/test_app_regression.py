"""Authenticated app regression test for the Supabase lockdown. Drives the real
signed-in site (persistent profile — run tests/auth.py first) through the pages
that depend on the privileges we kept for `authenticated`, and FAILS on any
permission-shaped error (HTTP 401/403 from Supabase, or 500 from the site's own
/api/* routes, which is what a missing table grant / function EXECUTE surfaces
as). Read-only: it only navigates, never submits.

Covers the retained authenticated surface:
  - SELECT on profiles / games / analysis / user_progress
  - EXECUTE on the user-facing RPCs (get_user_stats, get_detailed_user_stats,
    get_progress_over_time, ...) via the /account, /progress, /games pages.

Run AFTER the migration + deploy. Usage:
  poetry run python tests/test_app_regression.py
Env: BASE_URL / HEADLESS as usual.
"""
from __future__ import annotations

import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from playwright.async_api import ConsoleMessage, Response  # noqa: E402

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

PAGES = ["/games", "/analysis", "/account", "/progress", "/practice"]
SETTLE_MS = 6000
# Console/network signatures of a Postgres permission failure.
PERM_RE = re.compile(r"permission denied|42501|PGRST(116|301|302|202|203|204|205)|"
                     r"not.*allowed|row-level security", re.I)


async def main() -> None:
    headless = os.environ.get("HEADLESS", "0") == "1"
    ctx, page = await launch(headless=headless)
    problems: list[str] = []

    def on_response(resp: Response) -> None:
        try:
            url, st = resp.url, resp.status
        except Exception:
            return
        is_api = "/api/" in url
        is_supa = ".supabase.co" in url
        if (is_api or is_supa) and st in (401, 403, 500):
            problems.append(f"HTTP {st} {url.split('?')[0]}")

    def on_console(msg: ConsoleMessage) -> None:
        if msg.type == "error" and PERM_RE.search(msg.text or ""):
            problems.append(f"console: {msg.text[:160]}")

    page.on("response", on_response)
    page.on("console", on_console)

    try:
        # Confirm we're actually signed in first.
        await page.goto(f"{BASE_URL}/account", wait_until="domcontentloaded")
        await page.wait_for_timeout(SETTLE_MS)
        if "/auth/signin" in page.url or page.url.rstrip("/") == BASE_URL.rstrip("/"):
            print("[regression] FAIL: not signed in (bounced). Run tests/auth.py.")
            sys.exit(1)

        for path in PAGES:
            before = len(problems)
            await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")
            await page.wait_for_timeout(SETTLE_MS)
            new = problems[before:]
            landed = path.split("?")[0] in page.url
            status = "clean" if (not new and landed) else "ISSUES"
            print(f"[regression] {path:<12} -> {status}"
                  + ("" if landed else f" (url={page.url})"))
            for p in new:
                print(f"    {p}")

        print()
        if problems:
            print(f"[regression] FAIL: {len(problems)} permission-shaped error(s). "
                  "A retained grant/EXECUTE is likely missing — check the migration.")
            sys.exit(1)
        print("[regression] PASS: signed-in flows work; no permission errors.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
