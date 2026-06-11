"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "sky" | "emerald" | "violet" | "amber";
}

export function StatCard({ title, value, subtitle, color = "sky" }: StatCardProps) {
  const colorClasses = {
    sky: "bg-sky-500/10 border-sky-500/20 text-sky-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colorClasses[color].split(" ")[2]}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
      <div className="h-8 bg-gray-700 rounded w-2/3"></div>
    </div>
  );
}
