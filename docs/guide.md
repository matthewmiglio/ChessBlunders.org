# ChessBlunders.org: Project Specification

A web application that analyzes your Chess.com games to detect blunders and turn them into personalized training puzzles. All engine analysis runs in the visitor's browser; there are no analysis servers.

## Overview

The application:
1. Imports all Chess.com games for the signed-in user
2. Replays each game move-by-move in the browser
3. Runs Stockfish 16 NNUE (WebAssembly) on every position the user played
4. Detects blunders using an eval drop threshold (100 centipawns)
5. Stores blunders with the FEN, bad move, correct alternatives, and metadata
6. Provides an interactive practice mode requiring correct moves to continue

## Goals & Non-Goals

### Goals
- Fully automated pipeline: import games, analyze, produce blunder set, practice
- Find real blunders, not just sub-optimal moves
- Works with large game histories
- Zero per-analysis infrastructure cost (the user's machine does the work)

### Non-Goals
- Using Chess.com's built-in accuracy (not available via API)
- Human-like coaching or explanations
- Deep opening/endgame classification

---

## Architecture

```
Browser                                   Server (Vercel + Supabase)
-------                                   --------------------------
/analysis page
  +- analyzeGameClient -------------------> POST /api/analysis/save -> analysis table
       +- Stockfish NNUE (WASM worker)
            +- UCI driver (MultiPV 3)
```

### Web App (`website/`)
Next.js App Router application deployed at chessblunders.org via Vercel CI/CD (push to `main`).

### Engine (`website/lib/engines/`)
- Stockfish 16 NNUE compiled to multithreaded WebAssembly
- Assets served from `public/engines/stockfish-nnue/` (worker JS, WASM, ~40 MB NNUE weights) with 1-year immutable caching
- `uci-driver.ts` speaks the UCI protocol to the worker and supports MultiPV
- Multithreading needs `SharedArrayBuffer`, which requires cross-origin isolation. COOP/COEP headers are scoped in `next.config.ts` to only the routes that run the engine (`/analysis`, `/engine-test`) so OAuth popups and cross-origin images keep working everywhere else:
  - Engine pages: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`
  - `/engines/*` assets: `require-corp` plus `Cross-Origin-Resource-Policy: same-origin`

### Game Analysis (`website/lib/analysis/analyzeGameClient.ts`)
Client-side analyzer used by the /analysis page:
- Loads the PGN with chess.js and replays it
- Only the user's moves are analyzed (opponent moves are skipped)
- For each user move: evaluate the position before the move and after it (depth 12, MultiPV 3)
- A move is a blunder when the eval drop is >= 100 cp
- Games are analyzed sequentially through one engine instance; the UI shows progress and supports stop/resume

### Persistence
- The browser cannot write to the database directly. Computed blunders are sent to `POST /api/analysis/save`, which authenticates the user, verifies game ownership, deduplicates, enforces the free-tier limit (100 analyses), and inserts into the Supabase `analysis` table.
- Games, analyses, practice progress, and subscriptions live in Supabase (Postgres) behind Next.js API routes.

### Testing (`testing/`)
Python + Poetry + Playwright harness that tests the deployed site with a persistent Chrome profile. Includes a hidden, unindexed `/engine-test` page that exposes the raw engine (FEN eval) and the full game analyzer (PGN blunder detection) for deterministic end-to-end tests. See `testing/README.md`.

---

## Chess.com API

The Chess.com Public Data API (PubAPI) does not require authentication. You access games by username only.

**List monthly archives:**
```
GET https://api.chess.com/pub/player/{username}/games/archives
```

**Fetch games for a month:**
```
GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
```

Returns JSON with `games[]`, each containing `pgn` and metadata.

### Troubleshooting Missing Games
- Username typo
- Account privacy settings
- Recent games may be delayed due to caching

---

## Blunder Detection

### Evaluation Units
- Centipawns (cp): 100 cp = 1 pawn
- Mate scores are converted to +/-10000 cp for consistent drop calculations

### Eval Drop Calculation

UCI engines report scores from the side-to-move's perspective. The analyzer normalizes both evaluations to the user's perspective:

```
Before the user's move, the user is the side to move:
    eval_before = score                (already user POV)

After the user's move, the opponent is the side to move:
    eval_after = -score                (negate to user POV)

eval_drop = eval_before - eval_after
```

Positive drop means the user made their situation worse. This is color-independent; the same rule applies whether the user played white or black.

### Blunder Definition

A move is a blunder if `eval_drop >= 100 cp`.

### Correct Alternatives
- MultiPV 3 is requested for the position before the blunder
- The top 3 moves are stored as `top_moves` (used for best-move arrows in practice)

---

## Data Schema

Each analyzed game produces one `analysis` row with a `blunders` JSON array:

```json
{
  "move_number": 15,
  "fen": "FEN before the blunder",
  "move_played": "Qxe5",
  "best_move": "d4d5",
  "top_moves": [
    { "move": "d4d5", "score": 150, "pv": ["d4d5", "..."] },
    { "move": "c3c4", "score": 120, "pv": ["c3c4", "..."] }
  ],
  "eval_before": 150,
  "eval_after": -50,
  "eval_drop": 200
}
```

`move_played` is SAN; `best_move` and `top_moves[].move` are UCI. Evals are centipawns from the user's perspective.

---

## Engine Settings

| Setting | Value |
|---------|-------|
| Engine | Stockfish 16 NNUE (WASM) |
| Depth | 12 |
| MultiPV | 3 |
| Threads | min(hardwareConcurrency - 1, 8) |
| Hash | 64 MB |
| Blunder threshold | 100 cp |
| Analyze | User's moves only |

---

## Practice Mode

1. Blunder positions are shown as puzzles on the /practice page
2. The user must find a correct move to progress
3. Best-move arrows from `top_moves` are revealed on completion
4. Progress is tracked per user in Supabase

---

## Deployment

1. `cd website && npm run build` must pass locally
2. Push to `main`; Vercel CI/CD builds and deploys (~1-2 minutes)
3. Wait ~3 minutes after pushing before testing the live site
4. Run the `testing/` suite against production to verify
