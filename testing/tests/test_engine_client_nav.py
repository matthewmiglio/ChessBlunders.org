"""Regression test: the in-browser engine must work when /analysis is reached
by CLIENT-SIDE navigation, not just a hard page load. Runs against prod.

Why this test exists
====================
COOP/COEP headers grant crossOriginIsolation only on a real document fetch.
Users click the "Analyze" <Link> on /games (a non-isolated page), so Next.js
does a client-side navigation and the /analysis document is never re-fetched
with those headers — crossOriginIsolated stays false and the Stockfish engine
throws "Could not start the analysis engine in this browser".

The fix (useCrossOriginIsolationReload) does one hard reload of /analysis to
pick the headers up. The existing test_analysis_page.py hard-loads /analysis
directly, so it CANNOT catch a regression of that fix. This one reproduces the
real user path: land on /games, click the Link, and assert the engine works.

What it asserts
===============
1. Signed in (persistent profile — run tests/auth.py first).
2. /games is NOT crossOriginIsolated (confirms we reproduce the pre-fix state).
3. After clicking the "Analyze" Link, /analysis ends up crossOriginIsolated
   (the reload hook fired). Pre-fix this is false — the core regression check.
4. The engine actually runs: clicking Analyze analyzes and SAVES at least one
   game (analyzedGames increases) with no "could not start" failure. If every
   game is already analyzed, that step passes vacuously but the isolation
   assertion (#3) still gives us the regression signal.

Usage
=====
  poetry run python tests/test_engine_client_nav.py
Env: BASE_URL / HEADLESS overrides as usual. Test prod, not localhost, unless
you know your local build sends the engine-route COOP/COEP headers.
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from playwright.async_api import ConsoleMessage  # noqa: E402

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

GAMES_URL = f"{BASE_URL}/games"
FIRST_SAVE_TIMEOUT_S = 600
STOP_TIMEOUT_S = 180


async def get_stats(page) -> dict:
    return await page.evaluate("() => fetch('/api/analysis/stats').then(r => r.json())")


async def get_toasts(page) -> list[str]:
    return await page.evaluate(
        """() => [...document.querySelectorAll('[data-sonner-toast]')]
               .map(t => t.innerText.replace(/\\n/g, ' ').trim())"""
    )


async def isolated(page) -> bool:
    return await page.evaluate("() => window.crossOriginIsolated === true")


async def main() -> None:
    headless = os.environ.get("HEADLESS", "0") == "1"
    ctx, page = await launch(headless=headless)
    error_msgs: list[str] = []

    def on_console(msg: ConsoleMessage) -> None:
        if msg.type == "error":
            error_msgs.append(f"[error] {msg.text}")

    page.on("console", on_console)
    failures: list[str] = []
    seen_toasts: set[str] = set()

    try:
        # --- Land on /games (a non-isolated page), signed in ---
        await page.goto(GAMES_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(8000)  # client-side auth redirect settles
        if "/games" not in page.url:
            print("[client-nav] FAIL: redirected away from /games — not signed in. "
                  "Run tests/auth.py.")
            sys.exit(1)

        games_isolated = await isolated(page)
        print(f"[client-nav] /games crossOriginIsolated: {games_isolated}")
        if games_isolated:
            # Not a failure, but the reproduction is weaker — note it loudly.
            print("[client-nav] NOTE: /games is already isolated; the client-nav "
                  "regression path is not fully exercised (headers may be global).")

        # --- Click the in-app "Analyze" Link → client-side navigation ---
        link = await page.query_selector('a[href="/analysis"]')
        if link is None:
            print("[client-nav] FAIL: no Analyze <Link> on /games (no imported games?). "
                  "Import at least one game, then re-run.")
            sys.exit(1)

        await link.click()
        print("[client-nav] Clicked Analyze link; following client-side nav + reload...")

        # The reload hook does one full reload of /analysis. Wait for the URL to
        # settle on /analysis, then poll until isolation is restored (up to 20s).
        for _ in range(20):
            await page.wait_for_timeout(1000)
            if "/analysis" in page.url and await isolated(page):
                break
        await page.wait_for_load_state("load")

        analysis_isolated = await isolated(page)
        print(f"[client-nav] /analysis crossOriginIsolated after nav: {analysis_isolated} "
              f"(url={page.url})")
        if "/analysis" not in page.url:
            failures.append(f"did not land on /analysis (url={page.url})")
        if not analysis_isolated:
            failures.append(
                "crossOriginIsolated is false on /analysis after client-side nav — "
                "the reload fix is not working; engine cannot start"
            )

        # --- Prove the engine actually runs (only meaningful once isolated) ---
        if analysis_isolated:
            initial = await get_stats(page)
            print(f"[client-nav] Stats: {initial}")
            btn = await page.evaluate(
                """() => {
                     const b = [...document.querySelectorAll('button')]
                       .find(b => /Analyze/i.test(b.innerText));
                     return b ? { text: b.innerText.trim(), disabled: b.disabled } : null;
                   }"""
            )
            print(f"[client-nav] Analyze button: {btn}")
            if btn and "All Analyzed" in btn["text"]:
                print("[client-nav] All games already analyzed — engine run vacuous. "
                      "Isolation check above still validates the fix.")
            elif not btn:
                failures.append("no Analyze button found on /analysis")
            elif btn["disabled"]:
                failures.append(f"Analyze button disabled: {btn['text']}")
            else:
                await page.evaluate(
                    """() => [...document.querySelectorAll('button')]
                           .find(b => /Analyze/i.test(b.innerText)).click()"""
                )
                print(f"[client-nav] Clicked Analyze; waiting for a saved result "
                      f"(up to {FIRST_SAVE_TIMEOUT_S}s)...")
                saved = False
                for i in range(FIRST_SAVE_TIMEOUT_S // 10):
                    await page.wait_for_timeout(10_000)
                    for t in await get_toasts(page):
                        if t and t not in seen_toasts:
                            seen_toasts.add(t)
                            print(f"[client-nav] toast: {t}")
                            low = t.lower()
                            if "could not start" in low or "failed" in low or "unavailable" in low:
                                failures.append(f"failure toast: {t}")
                    if failures:
                        break
                    current = await get_stats(page)
                    if current.get("analyzedGames", 0) > initial.get("analyzedGames", 0):
                        print(f"[client-nav] Saved! analyzedGames "
                              f"{initial.get('analyzedGames')} -> {current.get('analyzedGames')}")
                        saved = True
                        break
                    still = await page.evaluate(
                        """() => [...document.querySelectorAll('button')]
                               .some(b => /Analyzing/i.test(b.innerText))"""
                    )
                    if not still:
                        final_check = await get_stats(page)
                        saved = final_check.get("analyzedGames", 0) > initial.get("analyzedGames", 0)
                        break
                if not failures and not saved:
                    failures.append("no analysis was saved within the timeout")

                # Keep the run bounded.
                clicked_stop = await page.evaluate(
                    """() => {
                         const b = [...document.querySelectorAll('button')]
                           .find(b => /^Stop/i.test(b.innerText.trim()));
                         if (b) { b.click(); return true; }
                         return false;
                       }"""
                )
                if clicked_stop:
                    for _ in range(STOP_TIMEOUT_S // 5):
                        await page.wait_for_timeout(5000)
                        still = await page.evaluate(
                            """() => [...document.querySelectorAll('button')]
                                   .some(b => /Analyzing|Stopping/i.test(b.innerText))"""
                        )
                        if not still:
                            break
                    print("[client-nav] Analysis stopped.")

        # Surface the specific engine error if it showed in the console.
        coi_errs = [m for m in error_msgs if "crossOriginIsolat" in m or "SharedArrayBuffer" in m
                    or "could not start" in m.lower()]
        if coi_errs:
            print("\n[client-nav] Engine/isolation console errors:")
            for m in coi_errs[:10]:
                print(f"  {m}")

        print()
        if failures:
            for f in failures:
                print(f"[client-nav] FAIL: {f}")
            sys.exit(1)
        print("[client-nav] PASS: engine works when /analysis is reached via client-side nav.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
