interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  // Risk / defect
  good: 'bg-success-dim text-success border-success/30',
  clean: 'bg-success-dim text-success border-success/30',
  low: 'bg-success-dim text-success border-success/30',
  normal: 'bg-success-dim text-success border-success/30',
  improving: 'bg-success-dim text-success border-success/30',
  verified: 'bg-success-dim text-success border-success/30',
  completed: 'bg-success-dim text-success border-success/30',

  medium: 'bg-warning-dim text-warning border-warning/30',
  watch: 'bg-warning-dim text-warning border-warning/30',
  stable: 'bg-warning-dim text-warning border-warning/30',
  in_progress: 'bg-warning-dim text-warning border-warning/30',
  open: 'bg-info-dim text-info border-info/30',

  high: 'bg-danger-dim text-danger border-danger/30',
  critical: 'bg-danger-dim text-danger border-danger/30',
  degrading: 'bg-danger-dim text-danger border-danger/30',
  defect: 'bg-danger-dim text-danger border-danger/30',
  closed: 'bg-[rgba(107,114,128,0.15)] text-text-secondary border-[rgba(107,114,128,0.3)]',

  // Quintiles
  Q1: 'bg-success-dim text-success border-success/30',
  Q2: 'bg-[rgba(16,185,129,0.1)] text-[#6ee7b7] border-[rgba(16,185,129,0.3)]',
  Q3: 'bg-warning-dim text-warning border-warning/30',
  Q4: 'bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border-[rgba(239,68,68,0.3)]',
  Q5: 'bg-danger-dim text-danger border-danger/30',

  no_data: 'bg-[rgba(107,114,128,0.1)] text-text-muted border-[rgba(107,114,128,0.3)]',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS['no_data'];
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${colorClass} ${sizeClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function DefectRateBadge({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(1);
  let color = 'text-success';
  if (rate > 0.07) color = 'text-danger';
  else if (rate > 0.03) color = 'text-warning';

  return <span className={`font-mono text-sm font-medium ${color}`}>{pct}%</span>;
}
