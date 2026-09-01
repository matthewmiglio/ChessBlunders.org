"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?:
    | "indigo"
    | "green"
    | "purple"
    | "amber"
    | "red"
    | "blue"
    | "sky"
    | "emerald"
    | "violet";
}

export function StatCard({ title, value, subtitle, color = "indigo" }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    indigo: "text-indigo-400",
    green: "text-green-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
    red: "text-red-400",
    blue: "text-blue-400",
    sky: "text-indigo-400",
    emerald: "text-green-400",
    violet: "text-purple-400",
  };

  return (
    <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colorClasses[color] || colorClasses.indigo}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
      <div className="h-8 bg-gray-200 rounded w-2/3"></div>
    </div>
  );
}
