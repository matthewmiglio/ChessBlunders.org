interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  valueColor?: string;
  centered?: boolean;
}

export function StatCard({
  label,
  value,
  sublabel,
  valueColor = "text-[#f5f5f5]",
  centered = false,
}: StatCardProps) {
  return (
    <div className={`bg-[#202020] border border-white/10 rounded-lg p-5 ${centered ? "text-center" : ""}`}>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="text-xs text-[#b4b4b4] uppercase tracking-wider mt-1">{label}</p>
      {sublabel && (
        <p className="text-xs text-[#666] mt-2">{sublabel}</p>
      )}
    </div>
  );
}
