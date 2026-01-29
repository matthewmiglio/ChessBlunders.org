# ChessBlunders.org

A chess training tool that analyzes your Chess.com games to find blunders and turn them into personalized training puzzles.

<img width="1893" height="897" alt="image" src="https://github.com/user-attachments/assets/4c70084b-c1e2-4ed4-8f20-086353bf18b7" />
<img width="1906" height="899" alt="image" src="https://github.com/user-attachments/assets/3da96d84-b4bd-4108-ab33-afff0dd75f41" />
<img width="1905" height="896" alt="image" src="https://github.com/user-attachments/assets/ef51d189-0002-4965-95da-123d882e87b5" />



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
