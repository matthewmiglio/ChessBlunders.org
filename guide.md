# Chess.com Blunder Trainer — Project Specification

A Python application that analyzes Chess.com games to detect blunders and create personalized training puzzles.

## Overview

The application:
1. Pulls all Chess.com games for a target user
2. Replays each game move-by-move
3. Runs a chess engine (Stockfish/LCZero) on every position
4. Detects blunders using an eval drop threshold (e.g., 60 centipawns)
5. Stores training puzzles with the FEN, bad move, correct alternatives, and metadata
6. Provides an interactive trainer requiring correct moves to continue

## Goals & Non-Goals

### Goals
- Fully automated pipeline: download games → analyze → produce blunder set → train
- Find real blunders, not just sub-optimal moves
- Works with large game histories
- Outputs data in JSON for future UI work

### Non-Goals (v1)
- Using Chess.com's built-in accuracy (not available via API)
- Human-like coaching or explanations
- Deep opening/endgame classification

---

## Requirements

### Functional
- Pull all games for a Chess.com username
- Parse each game PGN (including time controls, rated status)
- For each move: identify FEN before move, evaluate best outcome, evaluate played move, determine if blunder
- Store training entries with correct alternatives
- Trainer: show board, validate legal moves, require correct move to progress

### Non-Functional
- Runs locally
- Works offline after games are fetched
- Performance acceptable for thousands of games (batch + caching)
- Supports saving/loading results without re-analysis

---

## Chess.com API

The Chess.com Public Data API (PubAPI) does not require authentication. You access games by username only.

### Endpoints

**List monthly archives:**
```
GET https://api.chess.com/pub/player/{username}/games/archives
```

Returns URLs like:
```
https://api.chess.com/pub/player/{username}/games/2025/01
https://api.chess.com/pub/player/{username}/games/2025/02
```

**Fetch games for a month:**
```
GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
```

Returns JSON with `games[]`, each containing `pgn` and metadata.

### Troubleshooting Missing Games
- Username typo
- Account privacy settings
- Private games not published publicly
- Recent games may be delayed due to caching

---

## Architecture

### A) ChessComClient
- Fetch archive URLs
- Fetch games for each month
- Return list of games with PGN + metadata (game_url, pgn, time_class, rated, white/black usernames)

### B) GameParser
- Parse PGN using `python-chess`
- Replay moves on a chess board
- Produce stream of: `(ply_index, fen_before_move, played_move, side_to_move)`

### C) EngineAnalyzer
- Evaluate positions using UCI engine
- Retrieve: best move, best evaluation, top N moves (MultiPV)
- Evaluate played move by analyzing resulting position

### D) BlunderDetector
- Compare evaluation before/after
- Determine if move qualifies as blunder
- Store best alternatives

### E) BlunderDB
- Store results in JSON
- Re-load for training without re-analysis

### F) Trainer
- Interactive training loop
- Enforce correct move to continue

---

## Blunder Detection

### Evaluation Units
- Centipawns (cp): 100 cp = 1 pawn
- Mate scores converted to large cp values (e.g., ±100000)

### Eval Drop Calculation

Engines report eval from White's perspective. Compute drop from the mover's perspective:

```
If turn == White:
    drop_cp = best_eval_cp - played_eval_cp

If turn == Black:
    drop_cp = played_eval_cp - best_eval_cp
```

Positive drop = mover made their situation worse.

### Blunder Definition

A move is a blunder if:
1. `drop_cp >= BLUNDER_THRESHOLD_CP` (e.g., 60 cp)
2. At least one other legal move exists that doesn't lose as much

### Correct Moves
- Request MultiPV N moves from engine
- Collect moves where `alt_drop_cp < THRESHOLD_CP`
- Allows multiple "correct answers" when several strong moves exist

---

## Engine Options

### Stockfish (Recommended)
- Classical alpha-beta search + NNUE eval
- Top-tier strength, excellent speed
- CPU-based, easy UCI integration
- Download from [stockfish.org](https://stockfish.org)

### LCZero (Optional)
- Neural network + MCTS
- Requires GPU for best performance
- Needs network weights file
- UCI compatible: `lc0 --weights=...`

### Other UCI Engines
Ethereal, Berserk, Koivisto, Arasan, Crafty (mostly weaker than Stockfish)

---

## Engine Settings

### Recommended Stockfish Configuration
- **Threads:** As many as CPU supports
- **Hash:** 512MB – 2048MB
- **MultiPV:** 3–5
- **Analysis time per position:**
  - Fast: 0.05s–0.15s
  - Balanced: 0.2s–0.5s
  - High quality: 1.0s+

---

## Performance Optimizations

For large histories (2,000 games × 80 plies = 160,000 positions):

1. **Only analyze the user's moves** — skip opponent moves
2. **Skip hopeless positions** — ignore when `abs(best_eval_cp) > 900`
3. **Cache engine results per FEN**
4. **Batch save** — write results to disk every N games

---

## Data Schema

```json
{
  "id": "unique-id",
  "source": {
    "platform": "chess.com",
    "game_url": "...",
    "pgn_date": "2025-01-15",
    "time_class": "blitz",
    "rated": true
  },
  "player_context": {
    "username": "yourname",
    "as_color": "white"
  },
  "position": {
    "fen_before": "...",
    "side_to_move": "white",
    "move_number": 15,
    "ply_index": 29
  },
  "mistake": {
    "played_move_uci": "e4e5",
    "played_move_san": "e5"
  },
  "engine": {
    "engine_name": "stockfish",
    "analysis_time_s": 0.3,
    "multipv": 4
  },
  "evaluation": {
    "best_eval_cp": 150,
    "played_eval_cp": -50,
    "drop_cp": 200
  },
  "solutions": {
    "best_move_uci": "d4d5",
    "acceptable_moves": [
      { "move_uci": "d4d5", "eval_cp": 150, "drop_cp": 0 },
      { "move_uci": "c3c4", "eval_cp": 120, "drop_cp": 30 }
    ]
  }
}
```

---

## Trainer Specification

### Interaction Flow
1. Display board (ASCII), side to move, optional metadata
2. Prompt user for move in UCI format (e.g., `e2e4`)
3. Validate move format and legality
4. If incorrect: print "incorrect", repeat prompt
5. If correct: print "correct", advance to next puzzle

### Optional Commands
- `show` — reveal answer
- `hint` — show piece type or starting square
- `skip` — disabled by default (requirement: must solve to continue)

### UCI Promotions
Handle promotion suffix: `e7e8q` (queen), `e7e8n` (knight), etc.

---

## Configuration

```json
{
  "chesscom_username": "yourname",
  "engine": {
    "type": "stockfish",
    "path": "./engines/stockfish",
    "threads": 12,
    "hash_mb": 1024,
    "analysis_time_s": 0.3,
    "multipv": 4
  },
  "blunders": {
    "threshold_cp": 60,
    "ignore_if_abs_eval_cp_above": 900
  }
}
```

---

## Edge Cases

### PGN Parsing
- Filter to `rules == "chess"` only (exclude Chess960, variants)
- Ignore games with missing PGN or parse failures
- Handle aborted games

### Mate Scores
Convert to large cp values (±100000) for consistent drop calculations.

### MultiPV Instability
Increase analysis time if correct move lists seem inconsistent.

---

## Run Modes

- **fetch** — download games and store PGNs
- **analyze** — generate blunder set
- **train** — train on blunder set

---

## Deliverables

1. `blunders.json` — extracted blunder puzzles
2. CLI trainer — loads puzzles and runs training loop

---

## Recommended Defaults

| Setting | Value |
|---------|-------|
| Engine | Stockfish |
| Analysis time | 0.3s |
| MultiPV | 4 |
| Threshold | 60 cp |
| Analyze | User's moves only |
| Skip positions | abs(eval) > 900 cp |
