interface GameResultsCardProps {
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  gamesByTimeClass: Record<string, number>;
}

export function GameResultsCard({
  gamesWon,
  gamesLost,
  gamesDrawn,
  gamesByTimeClass,
}: GameResultsCardProps) {
  const totalGamesWithResult = gamesWon + gamesLost + gamesDrawn;

  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-[#f5f5f5] mb-6">
        Game Results
      </h2>
      {totalGamesWithResult > 0 ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#18be5d]">{gamesWon}</p>
            <p className="text-xs text-[#b4b4b4] uppercase tracking-wider mt-1">
              Wins ({Math.round((gamesWon / totalGamesWithResult) * 100)}%)
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#f44336]">{gamesLost}</p>
            <p className="text-xs text-[#b4b4b4] uppercase tracking-wider mt-1">
              Losses ({Math.round((gamesLost / totalGamesWithResult) * 100)}%)
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[#b4b4b4]">{gamesDrawn}</p>
            <p className="text-xs text-[#b4b4b4] uppercase tracking-wider mt-1">
              Draws ({Math.round((gamesDrawn / totalGamesWithResult) * 100)}%)
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[#b4b4b4] text-center py-4">No game results data available.</p>
      )}

      <h3 className="text-sm font-medium text-[#b4b4b4] uppercase tracking-wider mb-3 pt-4 border-t border-white/10">
        By Time Control
      </h3>
      {gamesByTimeClass && Object.keys(gamesByTimeClass).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(gamesByTimeClass)
            .sort(([, a], [, b]) => b - a)
            .map(([timeClass, count]) => (
              <div key={timeClass} className="flex justify-between items-center">
                <span className="text-sm text-[#b4b4b4] capitalize">{timeClass}</span>
                <span className="text-sm text-[#f5f5f5]">{count} games</span>
              </div>
            ))}
        </div>
      ) : (
        <p className="text-[#b4b4b4] text-sm">No time control data available.</p>
      )}
    </div>
  );
}
