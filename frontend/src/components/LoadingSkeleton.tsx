export function SkeletonCard({ height = 'h-32' }: { height?: string }) {
  return <div className={`skeleton ${height} w-full rounded-lg`} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="skeleton h-10 w-full rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-8 w-full rounded" />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }: { height?: string }) {
  return <div className={`skeleton ${height} w-full rounded-lg`} />;
}
