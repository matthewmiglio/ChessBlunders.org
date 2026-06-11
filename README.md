# ChessBlunders.org

A chess training tool that analyzes your Chess.com games to find blunders and turn them into personalized training puzzles. Analysis runs entirely in your browser with Stockfish 16 NNUE compiled to WebAssembly; there are no engine servers.

<img width="1893" height="897" alt="image" src="https://github.com/user-attachments/assets/4c70084b-c1e2-4ed4-8f20-086353bf18b7" />
<img width="1906" height="899" alt="image" src="https://github.com/user-attachments/assets/3da96d84-b4bd-4108-ab33-afff0dd75f41" />
<img width="1905" height="896" alt="image" src="https://github.com/user-attachments/assets/ef51d189-0002-4965-95da-123d882e87b5" />



## How It Works

1. Imports all your games from Chess.com
2. Replays each game in your browser and runs Stockfish 16 NNUE (multithreaded WebAssembly) on every position you played
3. Detects blunders using an evaluation drop threshold (100 centipawns)
4. Saves the blunders as training puzzles, including the engine's best alternatives
5. Trains you by requiring correct moves to progress

Because the engine runs client-side, analysis is free to operate at any scale: your machine does the work, and only the results are stored. See `docs/guide.md` for the full architecture, including the cross-origin isolation (COOP/COEP) setup that WebAssembly multithreading requires.

## Project Structure

### Web App (`website/`)

The main Next.js web application deployed at [chessblunders.org](https://chessblunders.org).

**Tech Stack:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- Stockfish 16 NNUE (WebAssembly, in `lib/engines/` + `public/engines/`)

**Development:**
```bash
cd website
npm install
npm run dev
```

### Dashboard (`dashboard/`)

An admin dashboard for monitoring site analytics and usage statistics.

**Tech Stack:**
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase

**Development:**
```bash
cd dashboard
npm install
npm run dev
```

### Testing (`testing/`)

Python + Playwright end-to-end tests that run against the deployed site, including engine and game-analysis verification. See `testing/README.md`.

### Docs (`docs/`)

Project specification and architecture notes.

## License

MIT
