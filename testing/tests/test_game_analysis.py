"""End-to-end test of the in-browser game analysis pipeline on /engine-test.

This exercises the exact production code path the /analysis page uses
(lib/analysis/analyzeGameClient.ts + the browser Stockfish engine) without
needing auth or touching real user data.

What this checks
================
1. /engine-test loads, crossOriginIsolated is true
2. Pasting a PGN reveals the ANALYZE GAME button
3. Analyzing white's moves in the fool's-mate game finds the 2.g4?? blunder:
   blunder count >= 1, g4 flagged, eval_drop large (mate-sized, >= 5000 cp)

Test game: 1. f3 e5 2. g4 Qh4#  (white's 2.g4 allows mate in one)

Usage
=====
  poetry run python tests/test_game_analysis.py
Env: BASE_URL=http://localhost:3000 for local builds, HEADLESS=1 for headless.
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from playwright.async_api import ConsoleMessage  # noqa: E402

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

PGN = "1. f3 e5 2. g4 Qh4#"
URL = f"{BASE_URL}/engine-test"

MIN_BLUNDER_DROP_CP = 5000  # g4 allows mate — drop should be mate-sized
ANALYSIS_TIMEOUT_S = 120


async def main() -> None:
    headless = os.environ.get("HEADLESS", "0") == "1"
    ctx, page = await launch(headless=headless)
    error_msgs: list[str] = []

    def on_console(msg: ConsoleMessage) -> None:
        if msg.type == "error":
            error_msgs.append(f"[error] {msg.text}")

    page.on("console", on_console)
    failures: list[str] = []

    try:
        resp = await page.goto(URL, wait_until="domcontentloaded")
        print(f"[game-analysis] Status: {resp.status if resp else '?'}")

        isolated = await page.evaluate("() => window.crossOriginIsolated")
        print(f"[game-analysis] crossOriginIsolated: {isolated}")
        if not isolated:
            failures.append("crossOriginIsolated is false")

        # Filling before React hydrates silently drops the input — wait for the
        # page to be interactive, then fill (retrying once if the PGN-only
        # button doesn't show up).
        await page.wait_for_selector('[data-testid="analyze-button"]', timeout=30_000)
        await page.wait_for_timeout(1500)

        button = None
        for attempt in range(2):
            await page.fill('[data-testid="position-input"]', PGN)
            try:
                button = await page.wait_for_selector(
                    '[data-testid="analyze-game-button"]', timeout=10_000
                )
                break
            except Exception:
                print(f"[game-analysis] ANALYZE GAME button not visible (attempt {attempt + 1})")

        if not button:
            failures.append("ANALYZE GAME button did not appear for PGN input")
        else:
            await button.click()
            print(f"[game-analysis] ANALYZE GAME clicked; waiting up to {ANALYSIS_TIMEOUT_S}s...")

            result = None
            for _ in range(ANALYSIS_TIMEOUT_S):
                await page.wait_for_timeout(1000)
                err = await page.evaluate(
                    """() => {
                         const el = document.querySelector('[data-testid="engine-error"]');
                         return el ? el.innerText : null;
                       }"""
                )
                if err:
                    failures.append(f"engine error shown on page: {err}")
                    break
                result = await page.evaluate(
                    """() => {
                         const el = document.querySelector('[data-testid="game-analysis"]');
                         if (!el) return null;
                         return {
                           count: Number(el.dataset.blunderCount),
                           blunders: [...el.querySelectorAll('[data-testid="game-blunder"]')]
                             .map(b => ({ move: b.dataset.movePlayed, drop: Number(b.dataset.evalDrop) })),
                         };
                       }"""
                )
                if result:
                    break

            print(f"[game-analysis] Result: {result}")

            if not result:
                failures.append("game analysis never produced a result")
            else:
                if result["count"] < 1:
                    failures.append("expected at least 1 blunder in fool's mate game, got 0")
                g4 = next((b for b in result["blunders"] if b["move"] == "g4"), None)
                if not g4:
                    failures.append("2.g4?? was not flagged as a blunder")
                elif g4["drop"] < MIN_BLUNDER_DROP_CP:
                    failures.append(
                        f"g4 eval_drop {g4['drop']} < {MIN_BLUNDER_DROP_CP} — should be mate-sized"
                    )

        if error_msgs:
            print(f"\n[game-analysis] Console errors ({len(error_msgs)}):")
            for m in error_msgs[:10]:
                print(f"  {m}")

        print()
        if failures:
            for f in failures:
                print(f"[game-analysis] FAIL: {f}")
            sys.exit(1)
        print("[game-analysis] PASS: client-side game analysis works.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
