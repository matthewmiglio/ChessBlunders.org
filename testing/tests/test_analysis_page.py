"""Authed smoke test of the real /analysis page with the in-browser engine.

Requires a signed-in persistent profile (run tests/auth.py first).

What this checks
================
1. /analysis loads signed-in (no redirect away) and crossOriginIsolated is true
2. If unanalyzed games exist: clicking the Analyze button starts in-browser
   analysis, at least one game gets analyzed and SAVED (analyzedGames count
   from /api/analysis/stats increases), with no failure toasts. The test then
   clicks Stop so it stays time-bounded regardless of how many games remain.
3. If everything is already analyzed: verifies the "All Analyzed" state and
   passes (nothing to exercise).

Usage
=====
  poetry run python tests/test_analysis_page.py
Env: BASE_URL / HEADLESS overrides as usual.
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from playwright.async_api import ConsoleMessage  # noqa: E402

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

URL = f"{BASE_URL}/analysis"

# Generous: one game at depth 12 takes ~1-2 min depending on length/hardware.
FIRST_SAVE_TIMEOUT_S = 600
STOP_TIMEOUT_S = 180


async def get_stats(page) -> dict:
    return await page.evaluate(
        "() => fetch('/api/analysis/stats').then(r => r.json())"
    )


async def get_toasts(page) -> list[str]:
    return await page.evaluate(
        """() => [...document.querySelectorAll('[data-sonner-toast]')]
               .map(t => t.innerText.replace(/\\n/g, ' ').trim())"""
    )


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
        resp = await page.goto(URL, wait_until="domcontentloaded")
        print(f"[analysis-page] Status: {resp.status if resp else '?'}")

        # Unauthenticated visitors are client-side redirected to "/"
        await page.wait_for_timeout(8000)
        if "/analysis" not in page.url:
            print("[analysis-page] FAIL: redirected away — not signed in. Run tests/auth.py.")
            sys.exit(1)

        isolated = await page.evaluate("() => window.crossOriginIsolated")
        print(f"[analysis-page] crossOriginIsolated: {isolated}")
        if not isolated:
            failures.append("crossOriginIsolated is false on /analysis — engine cannot start")

        initial = await get_stats(page)
        print(f"[analysis-page] Stats: {initial}")

        # The analyze button is the one whose label mentions Analyze/Analyzed
        btn = await page.evaluate(
            """() => {
                 const b = [...document.querySelectorAll('button')]
                   .find(b => /Analyze/i.test(b.innerText));
                 return b ? { text: b.innerText.trim(), disabled: b.disabled } : null;
               }"""
        )
        print(f"[analysis-page] Analyze button: {btn}")
        if not btn:
            failures.append("no Analyze button found on the page")
        elif "All Analyzed" in btn["text"]:
            print("[analysis-page] All games already analyzed — nothing to run. PASS (vacuous).")
            print("[analysis-page] To re-test for real, import new games first.")
        elif btn["disabled"]:
            failures.append(f"Analyze button is disabled: {btn['text']}")
        else:
            await page.evaluate(
                """() => [...document.querySelectorAll('button')]
                       .find(b => /Analyze/i.test(b.innerText)).click()"""
            )
            print("[analysis-page] Clicked Analyze; waiting for first saved analysis "
                  f"(up to {FIRST_SAVE_TIMEOUT_S}s)...")

            saved = False
            for i in range(FIRST_SAVE_TIMEOUT_S // 10):
                await page.wait_for_timeout(10_000)
                for t in await get_toasts(page):
                    if t and t not in seen_toasts:
                        seen_toasts.add(t)
                        print(f"[analysis-page] toast: {t}")
                        low = t.lower()
                        if "failed" in low or "unavailable" in low or "could not start" in low:
                            failures.append(f"failure toast: {t}")
                if failures:
                    break
                current = await get_stats(page)
                if current.get("analyzedGames", 0) > initial.get("analyzedGames", 0):
                    print(f"[analysis-page] Saved! analyzedGames "
                          f"{initial.get('analyzedGames')} -> {current.get('analyzedGames')} "
                          f"after ~{(i + 1) * 10}s")
                    saved = True
                    break
                # If analysis finished on its own (few games), accept that too
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

            # Stop any still-running analysis so the test stays bounded
            stop_btn = await page.evaluate(
                """() => {
                     const b = [...document.querySelectorAll('button')]
                       .find(b => /^Stop/i.test(b.innerText.trim()));
                     if (b) { b.click(); return true; }
                     return false;
                   }"""
            )
            if stop_btn:
                print("[analysis-page] Clicked Stop; waiting for analysis to wind down...")
                for _ in range(STOP_TIMEOUT_S // 5):
                    await page.wait_for_timeout(5000)
                    still = await page.evaluate(
                        """() => [...document.querySelectorAll('button')]
                               .some(b => /Analyzing|Stopping/i.test(b.innerText))"""
                    )
                    if not still:
                        break
                print("[analysis-page] Analysis stopped.")

        if error_msgs:
            print(f"\n[analysis-page] Console errors ({len(error_msgs)}):")
            for m in error_msgs[:10]:
                print(f"  {m}")

        print()
        if failures:
            for f in failures:
                print(f"[analysis-page] FAIL: {f}")
            sys.exit(1)
        print("[analysis-page] PASS: in-browser analysis on /analysis works.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
