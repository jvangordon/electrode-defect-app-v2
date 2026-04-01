import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonCard } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, ArrowUpRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { DashboardOverview, FurnaceStatus, RecentAnomaly, AttentionEquipment } from '../types';

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard(), []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { recent_stats, monthly_trend, furnace_status, investigation_counts, recent_anomalies, attention_equipment } = data;

  const totalInvestigations = Object.values(investigation_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  const openInvestigations = (investigation_counts.open || 0) + (investigation_counts.in_progress || 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Operations Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Real-time overview of electrode manufacturing quality</p>
        </div>
        <div className="text-xs text-text-muted">
          Last 90 days &middot; {recent_stats.total_runs} runs
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Defect Rate (90d)" value={`${(recent_stats.avg_defect_rate * 100).toFixed(1)}%`}
          trend={recent_stats.avg_defect_rate > 0.05 ? 'up' : 'down'} />
        <KpiCard label="Total Defects" value={recent_stats.total_defects?.toLocaleString()} />
        <KpiCard label="Electrodes Produced" value={recent_stats.total_pieces?.toLocaleString()} />
        <KpiCard label="Open Investigations" value={openInvestigations}
          sub={`of ${totalInvestigations} total`} />
        <KpiCard label="Equipment Alerts" value={attention_equipment?.length || 0}
          trend={attention_equipment?.length > 0 ? 'up' : undefined} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Defect rate trend */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Defect Rate Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly_trend.map(m => ({
              ...m,
              month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              rate: (m.defect_rate * 100),
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
              <Area type="monotone" dataKey="rate" name="Defect Rate"
                stroke="#f59e0b" fill="rgba(245,158,11,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Investigation summary */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-secondary">Investigations</h3>
            <Link to="/investigations" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {(['open', 'in_progress', 'closed', 'verified'] as const).map(status => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status} size="md" />
                <span className="font-mono text-sm text-text-primary">{investigation_counts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Furnace Status Grid + Recent Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Furnace Grid */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Furnace Status (last 5 runs each)</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {furnace_status.map((f: FurnaceStatus) => {
              const status = (f.trend_slope ?? 0) > 0.002 ? 'degrading' :
                f.avg_defect_rate > 0.08 ? 'high' :
                f.avg_defect_rate > 0.04 ? 'medium' : 'low';
              return (
                <Link
                  key={f.furnace}
                  to={`/equipment?furnace=${f.furnace}`}
                  className={`p-2.5 rounded-md border transition-colors cursor-pointer ${
                    status === 'degrading' || status === 'high'
                      ? 'border-danger/30 bg-danger-dim hover:border-danger/50'
                      : status === 'medium'
                      ? 'border-warning/30 bg-warning-dim hover:border-warning/50'
                      : 'border-border hover:border-border-light bg-bg-card-hover'
                  }`}
                >
                  <div className="text-xs font-medium text-text-primary">{f.furnace}</div>
                  <div className="text-[10px] text-text-muted uppercase">{f.department}</div>
                  <div className="mt-1">
                    <DefectRateBadge rate={f.avg_defect_rate} />
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">{f.recent_runs} runs</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-warning" />
              Recent High-Defect Runs
            </h3>
            <Link to="/anomaly" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {recent_anomalies.map((a: RecentAnomaly) => (
              <Link
                key={a.run_number}
                to={`/comparison?run=${a.run_number}`}
                className="flex items-center justify-between py-2 px-2 rounded hover:bg-bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-text-primary">{a.run_number}</span>
                  <span className="text-xs text-text-muted">{a.furnace}</span>
                  {a.risk_score && <StatusBadge status={a.risk_score} />}
                </div>
                <div className="flex items-center gap-3">
                  <DefectRateBadge rate={a.defect_rate} />
                  <span className="text-xs text-text-muted">{a.defect_count}/{a.total_pieces}</span>
                </div>
              </Link>
            ))}
            {recent_anomalies.length === 0 && (
              <div className="text-sm text-text-muted py-4 text-center">No high-defect runs</div>
            )}
          </div>
        </div>
      </div>

      {/* Equipment Attention */}
      {attention_equipment.length > 0 && (
        <div className="bg-danger-dim border border-danger/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-danger flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} />
            Equipment Requiring Attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {attention_equipment.map((e: AttentionEquipment) => (
              <Link
                key={e.furnace}
                to={`/equipment?furnace=${e.furnace}`}
                className="flex items-center justify-between p-3 rounded-md bg-bg-card border border-border hover:border-border-light transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary">{e.furnace}</div>
                  <div className="text-xs text-text-muted">{e.department}</div>
                </div>
                <div className="text-right">
                  <DefectRateBadge rate={e.defect_rate} />
                  <div className="text-[10px] text-danger mt-0.5">
                    slope: {(e.trend_slope * 100).toFixed(2)}%/mo
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: 'up' | 'down' }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <div className="text-[11px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-mono text-lg font-semibold text-text-primary">{value}</span>
        {trend && (
          <span className={`text-xs ${trend === 'up' ? 'text-danger' : 'text-success'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height="h-20" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-64" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="bg-danger-dim border border-danger/20 rounded-lg p-6 max-w-md text-center">
        <AlertTriangle size={24} className="text-danger mx-auto mb-2" />
        <div className="text-sm text-danger">{message}</div>
      </div>
    </div>
  );
}
