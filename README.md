# ChessBlunders.org

A chess training tool that analyzes your Chess.com games to find blunders and turn them into personalized training puzzles.

## How It Works

1. Fetches all your games from Chess.com
2. Replays each game and runs Stockfish analysis on every position
3. Detects blunders using an evaluation drop threshold
4. Creates training puzzles from your mistakes
5. Trains you by requiring correct moves to progress

## Project Structure

### Web App (`web_app/`)

The main Next.js web application deployed at [chessblunders.org](https://chessblunders.org).

**Tech Stack:**
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase

**Development:**
```bash
cd web_app
npm install
npm run dev
```

### Dashboard (`chessblunders-dashboard/`)

An admin dashboard for monitoring site analytics and usage statistics.

**Tech Stack:**
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Supabase

**Development:**
```bash
cd chessblunders-dashboard
npm install
npm run dev
```

## License

MIT
