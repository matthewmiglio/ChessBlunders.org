import { ProgressPeriod } from "@/lib/supabase";

interface WeeklyProgressChartProps {
  data: ProgressPeriod[];
}

export function WeeklyProgressChart({ data }: WeeklyProgressChartProps) {
  return (
    <div className="bg-[#202020] border border-white/10 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-[#f5f5f5] mb-6">
        Weekly Progress
      </h2>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {data.slice(-8).map((period, idx) => {
              const date = new Date(period.period);
              const weekLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const barHeight = Math.max(period.accuracy || 0, 5);
              return (
                <div key={idx} className="flex flex-col items-center gap-2 w-16">
                  <div className="h-32 w-full bg-[#3c3c3c] rounded-t relative flex items-end">
                    <div
                      className="w-full bg-[#8a2be2] rounded-t transition-all duration-500"
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-[#f5f5f5]">
                      {period.accuracy?.toFixed(0) || 0}%
                    </p>
                    <p className="text-xs text-[#b4b4b4]">{weekLabel}</p>
                    <p className="text-xs text-[#666]">{period.attempts} att.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[#b4b4b4] text-center py-8">
          No weekly data yet. Keep practicing to see your progress over time.
        </p>
      )}
    </div>
  );
}
