# ChessBlunders.org

A chess training tool that analyzes your Chess.com games to find blunders and turn them into personalized training puzzles.

## How It Works

1. Fetches all your games from Chess.com
2. Replays each game and runs Stockfish analysis on every position
3. Detects blunders using an evaluation drop threshold (default: 60 centipawns)
4. Creates training puzzles from your mistakes
5. Trains you by requiring correct moves to progress

## Implementations

### Local Python App (`local_python/`)

A command-line application for running analysis locally with your own Stockfish installation.

**Requirements:**
- Python 3.10+
- Stockfish engine

**Usage:**
```bash
cd local_python
pip install -r requirements.txt
python main.py --username <your-chess.com-username>
```

### Web App (`web_app/`)

A Next.js web application deployed at [chessblunders.org](https://chessblunders.org).

**Tech Stack:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

**Development:**
```bash
cd web_app
npm install
npm run dev
```

## Project Structure

```
ChessBlunders.org/
├── local_python/     # CLI Python implementation
├── web_app/          # Next.js web implementation
└── guide.md          # Detailed project specification
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Analysis time | 0.3s | Time per position |
| MultiPV | 4 | Number of alternative moves to consider |
| Threshold | 60 cp | Centipawn drop to qualify as blunder |
| Skip threshold | 900 cp | Ignore already-lost positions |

## License

MIT
