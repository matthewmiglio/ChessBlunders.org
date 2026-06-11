"""Interactive sign-in for the chessblunders testing harness.

Opens installed Chrome with a persistent profile at
`testing/data/browser_profile/`, navigates to the sign-in page, and waits for
you to complete sign-in. Once you're signed in and press Enter in this
terminal, the session is persisted and every other script in `tests/` will
reuse it.

Note: the /engine-test page needs no auth — run this only if a test exercises
signed-in pages, or to warm up the persistent profile.

DEPLOYMENT TIMING
=================
Vercel deploys take ~1-2 minutes. When testing a code change against the
deployed site:

  1. Edit code
  2. git commit && git push
  3. Wait 3 minutes (deploy + CDN buffer)
  4. Run a test script

If a script shows old behavior, you ran it too early — wait another minute.

Usage
=====
  poetry run python tests/auth.py
"""
from __future__ import annotations

import asyncio
import sys
import os

# Make `src.browser` importable when running this file directly.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.browser import BASE_URL, launch, shutdown  # noqa: E402


async def _confirm(prompt: str) -> None:
    """Block until the user explicitly types 'done'.

    A bare input() would also return on a stray newline buffered in stdin
    (which closes the browser before anyone can sign in), so require a word.
    """
    ans = ""
    while ans.strip().lower() not in ("done", "d", "y", "yes"):
        # asyncio + blocking input: run in the default executor so the event
        # loop stays free if there are any background page handlers.
        ans = await asyncio.get_event_loop().run_in_executor(None, input, prompt)


async def _signed_in(page) -> bool:
    """Visit a protected page and see if the client-side auth redirect fires."""
    await page.goto(f"{BASE_URL}/games", wait_until="domcontentloaded")
    # /games redirects unauthenticated visitors via client-side router.push
    # once the auth context resolves — give it time.
    for _ in range(10):
        await page.wait_for_timeout(1000)
        if "/auth/signin" in page.url:
            return False
    return True


async def main() -> None:
    ctx, page = await launch(headless=False)
    try:
        await page.goto(f"{BASE_URL}/auth/signin", wait_until="domcontentloaded")
        print(f"[auth] Browser open at {page.url}")
        print("[auth] Sign in in the browser window.")
        while True:
            await _confirm("[auth] Type 'done' + Enter here once you're signed in >> ")
            print("[auth] Verifying (takes ~10s)...")
            if await _signed_in(page):
                print("[auth] Verified: /games loads as a signed-in user. Session saved.")
                break
            print("[auth] Not signed in yet — /games bounced to /auth/signin.")
            await page.goto(f"{BASE_URL}/auth/signin", wait_until="domcontentloaded")
            print("[auth] Try again in the browser window.")
    finally:
        await shutdown(ctx)


if __name__ == "__main__":
    asyncio.run(main())
