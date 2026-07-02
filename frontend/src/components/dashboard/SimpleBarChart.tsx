type Props = {
  data: { label: string; value: number }[];
};

export default function SimpleBarChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="text-sm text-foreground/40">Нет данных за выбранный период</p>;
  }

  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-blue"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-[10px] text-foreground/40">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
