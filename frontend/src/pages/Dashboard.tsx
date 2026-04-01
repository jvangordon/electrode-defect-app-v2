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
import type { FurnaceStatus, RecentAnomaly, AttentionEquipment } from '../types';

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard(), []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { recent_stats, monthly_trend, furnace_status, investigation_counts, recent_anomalies, attention_equipment } = data;

  const totalInvestigations = Object.values(investigation_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  const openInvestigations = (investigation_counts.open || 0) + (investigation_counts.in_progress || 0);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Real-time overview of electrode manufacturing quality</p>
        </div>
        <div className="text-xs text-text-muted">
          Last 90 days &middot; {recent_stats.total_runs} runs
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Defect rate trend */}
        <div className="lg:col-span-2 bg-bg-card border border-border/60 rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-text-secondary mb-4">Defect Rate Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthly_trend.map(m => ({
              ...m,
              month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              rate: (m.defect_rate * 100),
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
              <Area type="monotone" dataKey="rate" name="Defect Rate"
                stroke="#f59e0b" fill="rgba(245,158,11,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Investigation summary */}
        <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-secondary">Investigations</h3>
            <Link to="/investigations" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={14} />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Furnace Grid */}
        <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-text-secondary mb-4">Furnace Status (last 5 runs each)</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {furnace_status.map((f: FurnaceStatus) => {
              const status = (f.trend_slope ?? 0) > 0.002 ? 'degrading' :
                f.avg_defect_rate > 0.08 ? 'high' :
                f.avg_defect_rate > 0.04 ? 'medium' : 'low';
              return (
                <Link
                  key={f.furnace}
                  to={`/equipment?furnace=${f.furnace}`}
                  className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                    status === 'degrading' || status === 'high'
                      ? 'border-danger/30 bg-danger-dim hover:border-danger/50'
                      : status === 'medium'
                      ? 'border-warning/30 bg-warning-dim hover:border-warning/50'
                      : 'border-border hover:border-border-light bg-bg-card-hover'
                  }`}
                >
                  <div className="text-sm font-semibold text-text-primary">{f.furnace}</div>
                  <div className="text-xs text-text-muted uppercase" style={{ minHeight: '16px', fontSize: '12px' }}>{f.department}</div>
                  <div className="mt-1.5">
                    <DefectRateBadge rate={f.avg_defect_rate} />
                  </div>
                  <div className="text-xs text-text-muted mt-1">{f.recent_runs} runs</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-secondary flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" />
              Recent High-Defect Runs
            </h3>
            <Link to="/anomaly" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {recent_anomalies.map((a: RecentAnomaly) => (
              <Link
                key={a.run_number}
                to={`/comparison?run=${a.run_number}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-text-primary">{a.run_number}</span>
                  <span className="text-sm text-text-muted">{a.furnace}</span>
                  {a.risk_score && <StatusBadge status={a.risk_score} />}
                </div>
                <div className="flex items-center gap-3">
                  <DefectRateBadge rate={a.defect_rate} />
                  <span className="text-sm text-text-muted">{a.defect_count}/{a.total_pieces}</span>
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
        <div className="bg-danger-dim border border-danger/20 rounded-xl p-6">
          <h3 className="text-base font-semibold text-danger flex items-center gap-2 mb-4">
            <TrendingUp size={16} />
            Equipment Requiring Attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attention_equipment.map((e: AttentionEquipment) => (
              <Link
                key={e.furnace}
                to={`/equipment?furnace=${e.furnace}`}
                className="flex items-center justify-between p-4 rounded-lg bg-bg-card border border-border hover:border-border-light hover:shadow-md transition-all"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary">{e.furnace}</div>
                  <div className="text-sm text-text-muted">{e.department}</div>
                </div>
                <div className="text-right">
                  <DefectRateBadge rate={e.defect_rate} />
                  <div className="text-xs text-danger mt-1">
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
    <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl shadow-sm p-6">
      <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-mono text-2xl font-bold text-text-primary">{value}</span>
        {trend && (
          <span className={`text-sm ${trend === 'up' ? 'text-danger' : 'text-success'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height="h-24" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SkeletonCard height="h-80" />
        <SkeletonCard height="h-80" />
        <SkeletonCard height="h-80" />
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
