interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: any, name: string) => string;
}

export default function ChartTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-bg-card border border-border-light rounded-lg px-3 py-2 shadow-lg">
      {label && <div className="text-xs text-text-muted mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary">{p.name}:</span>
          <span className="font-mono font-medium text-text-primary">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
