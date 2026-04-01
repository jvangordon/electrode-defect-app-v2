interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_COLORS: Record<string, string> = {
  // Risk / defect
  good: 'bg-success-dim text-success',
  clean: 'bg-success-dim text-success',
  low: 'bg-success-dim text-success',
  normal: 'bg-success-dim text-success',
  improving: 'bg-success-dim text-success',
  verified: 'bg-success-dim text-success',
  completed: 'bg-success-dim text-success',

  medium: 'bg-warning-dim text-warning',
  watch: 'bg-warning-dim text-warning',
  stable: 'bg-warning-dim text-warning',
  in_progress: 'bg-warning-dim text-warning',
  open: 'bg-info-dim text-info',

  high: 'bg-danger-dim text-danger',
  critical: 'bg-danger-dim text-danger',
  degrading: 'bg-danger-dim text-danger',
  defect: 'bg-danger-dim text-danger',
  closed: 'bg-[rgba(107,114,128,0.15)] text-text-secondary',

  // Quintiles
  Q1: 'bg-success-dim text-success',
  Q2: 'bg-[rgba(16,185,129,0.1)] text-[#6ee7b7]',
  Q3: 'bg-warning-dim text-warning',
  Q4: 'bg-[rgba(239,68,68,0.1)] text-[#fca5a5]',
  Q5: 'bg-danger-dim text-danger',

  no_data: 'bg-[rgba(107,114,128,0.1)] text-text-muted',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS['no_data'];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded font-medium ${colorClass} ${sizeClass}`}>
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
