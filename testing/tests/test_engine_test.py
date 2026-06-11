"""End-to-end test of the in-browser Stockfish engine on /engine-test.

What this checks
================
1. https://chessblunders.org/engine-test loads (no auth required)
2. crossOriginIsolated === true (scoped COOP/COEP headers are live)
3. Pasting a FEN renders the board
4. Clicking ANALYZE produces an evaluation at depth >= 12
5. The evaluation is sensible for the test position (BLACK clearly winning):
   mate for black OR black advantage >= 3.00 — and NOT 0 cp at depth 0.

Test position: 1r5k/4PRp1/5b1p/p1p5/4n3/PP6/1B4PP/6K1 b - - 0 37
Black to move, up a knight for a pawn. White's e7 pawn looks scary but is
lost: e8 is covered by the b8 rook and e7 is attacked by the f6 bishop, so
black simply rounds it up (engine line starts ...Kg8 hitting the f7 rook).
Stockfish NNUE at depth 18 gives about -5 (white POV).

DEPLOYMENT TIMING
=================
Vercel deploys take ~1-2 minutes. Wait 3 minutes after `git push` before
running this — otherwise you'll be testing the previous build.

Usage
=====
  poetry run python tests/test_engine_test.py
"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from playwright.async_api import ConsoleMessage  # noqa: E402

from src.browser import BASE_URL, launch, shutdown  # noqa: E402

FEN = "1r5k/4PRp1/5b1p/p1p5/4n3/PP6/1B4PP/6K1 b - - 0 37"
URL = f"{BASE_URL}/engine-test"

MIN_DEPTH = 12
MAX_WHITE_CP = -300  # -3.00 — black should be clearly winning here
ANALYSIS_TIMEOUT_S = 90


async def main() -> None:
    headless = os.environ.get("HEADLESS", "0") == "1"
    ctx, page = await launch(headless=headless)
    engine_msgs: list[str] = []
    error_msgs: list[str] = []

    def on_console(msg: ConsoleMessage) -> None:
        txt = msg.text
        if any(k in txt.lower() for k in ("stockfish", "worker", "wasm", "engine", "nnue", "crossorigin", "coep")):
            engine_msgs.append(f"[{msg.type}] {txt}")
        if msg.type == "error":
            error_msgs.append(f"[error] {txt}")

    page.on("console", on_console)
    failures: list[str] = []

    try:
        resp = await page.goto(URL, wait_until="domcontentloaded")
        print(f"[engine-test] Status: {resp.status if resp else '?'}")
        if not resp or resp.status != 200:
            failures.append(f"page returned status {resp.status if resp else '?'}")

        isolated = await page.evaluate("() => window.crossOriginIsolated")
        print(f"[engine-test] crossOriginIsolated: {isolated}")
        if not isolated:
            failures.append("crossOriginIsolated is false — COOP/COEP headers missing on /engine-test")

        # Paste the FEN and confirm the board renders it.
        await page.fill('[data-testid="position-input"]', FEN)
        await page.wait_for_timeout(1000)
        piece_count = await page.evaluate(
            """() => document.querySelectorAll(
                 '[data-piece], [class*="piece"], [data-square] img, [data-square] svg'
               ).length"""
        )
        print(f"[engine-test] Pieces rendered: {piece_count}")
        if piece_count == 0:
            failures.append("board did not render any pieces after FEN input")

        parse_error = await page.evaluate(
            """() => {
                 const el = document.querySelector('[data-testid="parse-error"]');
                 return el ? el.innerText : null;
               }"""
        )
        if parse_error:
            failures.append(f"FEN was rejected by the page: {parse_error}")

        # Analyze.
        await page.click('[data-testid="analyze-button"]')
        print(f"[engine-test] ANALYZE clicked; waiting for depth >= {MIN_DEPTH} "
              f"(up to {ANALYSIS_TIMEOUT_S}s)...")

        result = None
        for _ in range(ANALYSIS_TIMEOUT_S):
            await page.wait_for_timeout(1000)
            result = await page.evaluate(
                """() => {
                     const el = document.querySelector('[data-testid="engine-eval"]');
                     if (!el) return null;
                     return {
                       evalCp: el.dataset.evalCp,
                       mate: el.dataset.mate,
                       depth: el.dataset.depth,
                       bestmove: el.dataset.bestmove,
                       text: el.innerText.replace(/\\n/g, ' '),
                     };
                   }"""
            )
            err = await page.evaluate(
                """() => {
                     const el = document.querySelector('[data-testid="engine-error"]');
                     return el ? el.innerText : null;
                   }"""
            )
            if err:
                failures.append(f"engine error shown on page: {err}")
                break
            if result and result["depth"] and int(result["depth"]) >= MIN_DEPTH:
                analyzing = await page.evaluate(
                    """() => document.querySelector('[data-testid="analyze-button"]')
                            ?.innerText.toUpperCase().includes('ANALYZING')"""
                )
                if not analyzing:
                    break

        print(f"[engine-test] Result: {result}")

        if not result:
            failures.append("no evaluation appeared")
        else:
            depth = int(result["depth"]) if result["depth"] else 0
            cp = int(result["evalCp"]) if result["evalCp"] not in (None, "") else None
            mate = int(result["mate"]) if result["mate"] not in (None, "") else None

            if depth < MIN_DEPTH:
                failures.append(f"depth {depth} < required {MIN_DEPTH}")
            if cp in (None, 0) and mate is None and depth == 0:
                failures.append("evaluation is 0 at depth 0 — engine did not actually run")
            if mate is not None:
                if mate < 0:
                    print(f"[engine-test] Black mates in {abs(mate)} — sensible (black winning).")
                else:
                    failures.append(f"engine claims WHITE mates in {mate} — wildly inaccurate")
            elif cp is not None:
                pawns = cp / 100
                print(f"[engine-test] White eval: {pawns:+.2f} at depth {depth}")
                if cp > MAX_WHITE_CP:
                    failures.append(
                        f"white eval {pawns:+.2f} > {MAX_WHITE_CP / 100:.2f} — "
                        "expected black clearly winning (up a knight, e7 pawn falls)"
                    )
            else:
                failures.append("evaluation has neither cp nor mate value")

        if engine_msgs:
            print(f"\n[engine-test] Engine console messages ({len(engine_msgs)}):")
            for m in engine_msgs[:20]:
                print(f"  {m}")
        if error_msgs:
            print(f"\n[engine-test] Console errors ({len(error_msgs)}):")
            for m in error_msgs[:20]:
                print(f"  {m}")

        print()
        if failures:
            for f in failures:
                print(f"[engine-test] FAIL: {f}")
            sys.exit(1)
        print("[engine-test] PASS: engine evaluation is sensible.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
