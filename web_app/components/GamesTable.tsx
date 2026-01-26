import { Game } from "@/lib/supabase";

interface GamesTableProps {
  games: Game[];
}

export function GamesTable({ games }: GamesTableProps) {
  if (games.length === 0) {
    return (
      <div className="bg-[#202020] border border-white/10 rounded-lg p-12 text-center">
        <div className="w-16 h-16 rounded-lg bg-[#3c3c3c] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#b4b4b4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-[#b4b4b4] mb-2">
          No games imported yet
        </p>
        <p className="text-[#b4b4b4]/70 text-sm">
          Select how many games to import and click &quot;Import Games&quot; to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-6 py-4 text-left text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
              Opponent
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
              Color
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
              Result
            </th>
            <th className="px-6 py-4 text-left text-xs font-medium text-[#b4b4b4] uppercase tracking-wider">
              Time Control
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {games.map((game) => (
            <tr key={game.id} className="hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#b4b4b4]">
                {game.played_at
                  ? new Date(game.played_at).toLocaleDateString()
                  : "Unknown"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#f5f5f5] font-medium">
                {game.opponent}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                    game.user_color === "white"
                      ? "bg-[#f5f5f5] text-[#202020]"
                      : "bg-[#3c3c3c] text-[#f5f5f5]"
                  }`}
                >
                  {game.user_color}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`font-medium ${
                  game.result === "win" ? "text-[#18be5d]" :
                  ["resigned", "checkmated", "timeout", "abandoned", "loss"].includes(game.result || "") ? "text-[#f44336]" :
                  "text-[#b4b4b4]"
                }`}>
                  {game.result}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#b4b4b4]/70">
                {game.time_class}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
