import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonCard } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import DateRangeFilter, { getInitialRange } from '../components/DateRangeFilter';
import type { DateRange } from '../components/DateRangeFilter';
import { useTheme } from '../App';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, TrendingUp, ArrowUpRight, DollarSign } from 'lucide-react';
import PriorityActions from '../components/PriorityActions';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCost } from '../lib/format';
import type { FurnaceStatus, RecentAnomaly, AttentionEquipment } from '../types';

function useCardClass() {
  const { isDark } = useTheme();
  return isDark
    ? 'bg-[#141824] border border-[#252a3a] rounded-xl'
    : 'bg-white border border-[#e2e5eb] rounded-xl shadow-sm';
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getInitialRange('90d'));
  const dateParams: Record<string, string> = {};
  if (dateRange.startDate) dateParams.start_date = dateRange.startDate;
  if (dateRange.endDate) dateParams.end_date = dateRange.endDate;

  const { data, loading, error } = useApi(() => api.getDashboard(Object.keys(dateParams).length ? dateParams : undefined), [dateRange.startDate, dateRange.endDate]);
  const { isDark } = useTheme();
  const card = useCardClass();
  const navigate = useNavigate();

  const [activeRun, setActiveRun] = useState<any>(null);
  useEffect(() => {
    api.getActiveRun().then(setActiveRun).catch(() => {});
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { recent_stats, monthly_trend, furnace_status, investigation_counts, recent_anomalies, attention_equipment } = data;

  const totalInvestigations = Object.values(investigation_counts as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
  const openInvestigations = (investigation_counts.open || 0) + (investigation_counts.in_progress || 0);

  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';

  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      {/* Active Run Banner */}
      {activeRun && activeRun.run_number && (
        <div
          onClick={() => navigate('/live')}
          className="cursor-pointer rounded-xl p-5 mb-6 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, #0f2027 0%, #1a1a2e 50%, #16213e 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="font-mono font-bold text-emerald-400">
                {activeRun.furnace} Run {activeRun.run_number}
              </span>
              <span className="text-sm text-gray-400 ml-3">
                In Progress — {activeRun.total_pieces} electrodes loaded — Status: Monitoring
              </span>
            </div>
          </div>
          <span className="text-sm text-emerald-400/70">View Live Monitor →</span>
        </div>
      )}

      {/* Priority Actions — what needs attention right now */}
      <PriorityActions />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>Operations Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>Real-time overview of electrode manufacturing quality</p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangeFilter defaultPreset="90d" onChange={setDateRange} />
          <div className="text-[13px]" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>
            {recent_stats.total_runs} runs
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-5">
        <KpiCard label="Defect Rate (90d)" value={`${(recent_stats.avg_defect_rate * 100).toFixed(1)}%`}
          trend={recent_stats.avg_defect_rate > 0.05 ? 'up' : 'down'} />
        <KpiCard label="Total Defects" value={recent_stats.total_defects?.toLocaleString()}
          sub={recent_stats.total_defect_cost ? `${formatCost(recent_stats.total_defect_cost)} impact` : undefined} />
        <KpiCard label="Defect Cost (90d)" value={formatCost(recent_stats.total_defect_cost || 0)}
          trend={(recent_stats.total_defect_cost || 0) > 50000 ? 'up' : undefined} costHighlight />
        <KpiCard label="Electrodes Produced" value={recent_stats.total_pieces?.toLocaleString()} />
        <KpiCard label="Open Investigations" value={openInvestigations}
          sub={`of ${totalInvestigations} total`} />
        <KpiCard label="Equipment Alerts" value={attention_equipment?.length || 0}
          trend={attention_equipment?.length > 0 ? 'up' : undefined} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Defect rate trend */}
        <div className={`lg:col-span-2 ${card} p-6`}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>Defect Rate Trend (6 months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthly_trend.map(m => ({
              ...m,
              month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
              rate: (m.defect_rate * 100),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="month" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 13 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
              <Area type="monotone" dataKey="rate" name="Defect Rate"
                stroke="#f59e0b" fill="rgba(245,158,11,0.08)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Investigation summary */}
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>Investigations</h3>
            <Link to="/investigations" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-4">
            {(['open', 'in_progress', 'closed', 'verified'] as const).map(status => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status} size="md" />
                <span className="font-mono text-base font-semibold" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{investigation_counts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Furnace Status Grid + Recent Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
        {/* Furnace Grid */}
        <div className={`${card} p-6 lg:col-span-3`}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>Furnace Status (last 5 runs each)</h3>
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
                      : isDark
                      ? 'border-[#252a3a] hover:border-border-light bg-[#141824]'
                      : 'border-[#e2e5eb] hover:border-[#c5c9d4] bg-[#f8f9fb]'
                  }`}
                >
                  <div className="text-sm font-semibold" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{f.furnace}</div>
                  <div className="text-xs uppercase mt-0.5" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{f.department}</div>
                  <div className="mt-2">
                    <DefectRateBadge rate={f.avg_defect_rate} />
                  </div>
                  <div className="text-[13px] mt-1" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{f.recent_runs} runs</div>
                  {(f as any).defect_cost > 0 && (
                    <div className="text-[13px] font-mono mt-0.5" style={{ color: '#f59e0b' }}>{formatCost((f as any).defect_cost)}</div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className={`${card} p-6 flex flex-col lg:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>
              <AlertTriangle size={16} className="text-warning" />
              Recent High-Defect Runs
            </h3>
            <Link to="/anomaly" className="text-sm text-accent hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-1 flex-1 overflow-y-auto overscroll-contain">
            {recent_anomalies.map((a: RecentAnomaly) => (
              <div
                key={a.run_number}
                onClick={(e) => {
                  // Only navigate on deliberate click, not drag/scroll
                  const target = e.target as HTMLElement;
                  if (!target.closest('a')) {
                    window.location.hash = `/comparison?run=${a.run_number}`;
                  }
                }}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{a.run_number}</span>
                  <span className="text-sm" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{a.furnace}</span>
                  {a.risk_score && <StatusBadge status={a.risk_score} />}
                </div>
                <div className="flex items-center gap-3">
                  <DefectRateBadge rate={a.defect_rate} />
                  <span className="text-sm" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{a.defect_count}/{a.total_pieces}</span>
                  {(a as any).defect_cost > 0 && (
                    <span className="text-sm font-mono" style={{ color: '#f59e0b' }}>{formatCost((a as any).defect_cost)}</span>
                  )}
                </div>
              </div>
            ))}
            {recent_anomalies.length === 0 && (
              <div className="text-sm py-6 text-center" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>No high-defect runs</div>
            )}
          </div>
        </div>
      </div>

      {/* Equipment Attention */}
      {attention_equipment.length > 0 && (
        <div className="bg-danger-dim border border-danger/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-danger flex items-center gap-2 mb-4">
            <TrendingUp size={16} />
            Equipment Requiring Attention
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {attention_equipment.map((e: AttentionEquipment) => (
              <Link
                key={e.furnace}
                to={`/equipment?furnace=${e.furnace}`}
                className={`flex items-center justify-between p-5 rounded-lg ${card} hover:shadow-md transition-all`}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{e.furnace}</div>
                  <div className="text-sm" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{e.department}</div>
                </div>
                <div className="text-right">
                  <DefectRateBadge rate={e.defect_rate} />
                  <div className="text-[13px] text-danger mt-1">
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

function KpiCard({ label, value, sub, trend, costHighlight }: { label: string; value: string | number; sub?: string; trend?: 'up' | 'down'; costHighlight?: boolean }) {
  const { isDark } = useTheme();
  const card = isDark
    ? 'bg-[#141824] border border-[#252a3a]'
    : 'bg-white border border-[#e2e5eb] shadow-sm';

  return (
    <div className={`${card} rounded-xl p-6`}>
      <div className="text-sm uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: costHighlight ? '#f59e0b' : isDark ? '#6b7280' : '#8b8fa3' }}>
        {costHighlight && <DollarSign size={14} />}
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="font-mono text-3xl font-bold" style={{ color: costHighlight ? '#f59e0b' : isDark ? '#e5e7eb' : '#1a1d2b' }}>{value}</span>
        {trend && (
          <span className={`text-sm ${trend === 'up' ? 'text-danger' : 'text-success'}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      {sub && <div className="text-[13px] mt-1" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{sub}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      <div className="skeleton h-10 w-64 rounded" />
      <div className="grid grid-cols-5 gap-5">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} height="h-28" />)}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <SkeletonCard height="h-80" />
        <SkeletonCard height="h-80" />
        <SkeletonCard height="h-80" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-10 flex items-center justify-center min-h-[400px]">
      <div className="bg-danger-dim border border-danger/20 rounded-lg p-6 max-w-md text-center">
        <AlertTriangle size={24} className="text-danger mx-auto mb-2" />
        <div className="text-sm text-danger">{message}</div>
      </div>
    </div>
  );
}
