type Props = {
  data: { label: string; value: number }[];
};

const COLORS = [
  "var(--color-blue)",
  "var(--color-gold)",
  "var(--color-navy)",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "var(--color-gold-dark)",
];

export default function SimplePieChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0 || data.length === 0) {
    return <p className="text-sm text-foreground/40">Нет данных за выбранный период</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const dashes = data.map((d) => (d.value / total) * circumference);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        {data.map((d, i) => {
          const dash = dashes[i];
          const offset = dashes.slice(0, i).reduce((sum, prev) => sum + prev, 0);
          return (
            <circle
              key={d.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth="20"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-foreground/70">{d.label}</span>
            <span className="font-semibold text-navy">
              {d.value} · {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
