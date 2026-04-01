export function SkeletonCard({ height = 'h-32' }: { height?: string }) {
  return <div className={`skeleton ${height} w-full rounded-xl`} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="skeleton h-12 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }: { height?: string }) {
  return <div className={`skeleton ${height} w-full rounded-xl`} />;
}
