# chessblunders testing harness

Playwright-driven scripts for testing the deployed site at
https://chessblunders.org with a persistent Chrome profile, modeled on the
chesspecker `testing/` harness.

## Setup

```bash
cd testing
poetry install
poetry run playwright install chromium
```

(Installed Chrome is preferred automatically via `channel="chrome"`; the
Chromium download is the fallback.)

## Auth (one-time, only for signed-in tests)

```bash
poetry run python tests/auth.py
```

Sign in in the opened browser window, then press Enter in the terminal. The
session persists in `data/browser_profile/` and is reused by all scripts.
The `/engine-test` page itself requires no auth.

## Tests

```bash
poetry run python tests/test_engine_test.py
```

Visits `/engine-test`, pastes a known black-winning FEN, clicks ANALYZE, and
asserts the in-browser Stockfish NNUE evaluation is sensible (mate for black
or <= -3.00 white POV, depth >= 12, not 0/0). Exits non-zero on failure.

Env overrides: `BASE_URL=http://localhost:3000` to test a local build,
`HEADLESS=1` to run without a visible browser window.

## Deployment timing

Vercel deploys take ~1-2 minutes. After `git push`, wait 3 minutes before
running a test, or you'll hit the previous build.
