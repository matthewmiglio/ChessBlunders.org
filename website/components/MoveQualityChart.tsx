interface MoveQualityData {
  label: string;
  count: number;
  percent: number;
  color: string;
}

interface MoveQualityChartProps {
  data: MoveQualityData[];
}

export function MoveQualityChart({ data }: MoveQualityChartProps) {
  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-[#f5f5f5] mb-6">
        Move Quality Distribution
      </h2>
      {data.length > 0 ? (
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-[#b4b4b4]">{item.label}</span>
                <span className="text-sm text-[#f5f5f5]">
                  {item.percent}% ({item.count})
                </span>
              </div>
              <div className="h-3 bg-[#3c3c3c] rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[#b4b4b4] text-center py-8">
          No practice attempts yet. Start practicing to see your move quality distribution.
        </p>
      )}
    </div>
  );
}
