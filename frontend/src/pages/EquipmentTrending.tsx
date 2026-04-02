import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonCard, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import DateRangeFilter, { getInitialRange } from '../components/DateRangeFilter';
import type { DateRange } from '../components/DateRangeFilter';
import { useTheme } from '../App';
import { useLocation } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend,
} from 'recharts';
import { formatCost } from '../lib/format';
import type { EquipmentItem, EquipmentTrendsResponse, EquipmentComparisonItem, MonthlyEquipmentData, TrendPoint } from '../types';

function useCardClass() {
  const { isDark } = useTheme();
  return isDark
    ? 'bg-[#141824] border border-[#252a3a] rounded-xl'
    : 'bg-white border border-[#e2e5eb] rounded-xl shadow-sm';
}

export default function EquipmentTrending() {
  const [department, setDepartment] = useState<string>('');
  const [selectedFurnace, setSelectedFurnace] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getInitialRange('All'));
  const { isDark } = useTheme();
  const card = useCardClass();
  const location = useLocation();

  // Pre-select furnace from URL query param (e.g. /equipment?furnace=BF-3)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const furnaceParam = params.get('furnace');
    if (furnaceParam) {
      setSelectedFurnace(furnaceParam);
    }
  }, [location.search]);

  const dateParams: Record<string, string> = {};
  if (dateRange.startDate) dateParams.start_date = dateRange.startDate;
  if (dateRange.endDate) dateParams.end_date = dateRange.endDate;

  const { data: equipData, loading: equipLoading } = useApi(
    () => api.getEquipment(department || undefined, Object.keys(dateParams).length ? dateParams : undefined),
    [department, dateRange.startDate, dateRange.endDate],
  );
  const { data: trendData, loading: trendLoading } = useApi(
    () => selectedFurnace ? api.getEquipmentTrends(selectedFurnace) : Promise.resolve(null),
    [selectedFurnace],
  );
  const { data: compData, loading: compLoading } = useApi(
    () => api.getEquipmentComparison(department || undefined),
    [department],
  );

  const equipment = equipData?.equipment || [];
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>Equipment Trending</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter defaultPreset="All" onChange={setDateRange} />
          {[{ v: '', l: 'All' }, { v: 'bake', l: 'Bake' }, { v: 'graphite', l: 'Graphite' }].map(d => (
            <button key={d.v} onClick={() => { setDepartment(d.v); setSelectedFurnace(null); }}
              className={`px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${
                department === d.v ? 'bg-accent text-black' :
                isDark ? 'bg-[#141824] text-[#9ca3af] border border-[#252a3a] hover:text-[#e5e7eb]'
                : 'bg-white text-[#4b5068] border border-[#e2e5eb] hover:text-[#1a1d2b]'
              }`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Equipment list */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
            <h3 className="text-[14px] font-semibold tracking-wide" style={{ color: textSecondary }}>Equipment (sorted by defect rate)</h3>
          </div>
          {equipLoading ? <div className="p-4 space-y-3">{Array.from({length: 8}).map((_, i) => <SkeletonCard key={i} height="h-14" />)}</div> : (
            <div className="max-h-[600px] overflow-y-auto">
              {equipment.map((e: EquipmentItem) => {
                const TrendIcon = e.trend_direction === 'degrading' ? TrendingUp :
                  e.trend_direction === 'improving' ? TrendingDown : Minus;
                const trendColor = e.trend_direction === 'degrading' ? 'text-danger' :
                  e.trend_direction === 'improving' ? 'text-success' : 'text-text-muted';

                return (
                  <div key={e.furnace}
                    onClick={() => setSelectedFurnace(e.furnace)}
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-bg-card-hover ${
                      selectedFurnace === e.furnace
                        ? isDark ? 'bg-[#252421] border-l-[3px] border-l-amber-500' : 'bg-amber-50 border-l-[3px] border-l-amber-500'
                        : ''
                    }`}
                    style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: textPrimary }}>{e.furnace}</div>
                      <div className="text-[13px]" style={{ color: textMuted }}>{e.department} · {e.run_count} runs/mo</div>
                      {(e as any).total_defect_cost > 0 && (
                        <div className="text-[13px] font-mono" style={{ color: '#f59e0b' }}>{formatCost((e as any).total_defect_cost)} total</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <DefectRateBadge rate={e.defect_rate} />
                      <TrendIcon size={14} className={trendColor} />
                      <StatusBadge status={e.trend_direction} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trend charts */}
        <div className="lg:col-span-2 space-y-5">
          {selectedFurnace && trendData && !trendLoading ? (
            <TrendCharts data={trendData} />
          ) : trendLoading ? (
            <div className="space-y-5">
              <SkeletonChart height="h-52" />
              <div className="grid grid-cols-2 gap-5">
                <SkeletonChart height="h-44" />
                <SkeletonChart height="h-44" />
              </div>
            </div>
          ) : (
            <div className={`${card} h-[300px] flex items-center justify-center text-sm`} style={{ color: textMuted }}>
              Select equipment to view trends
            </div>
          )}

          {/* Cross-equipment comparison */}
          {compData && !compLoading && (
            <div className={`${card} p-6`}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: textSecondary }}>Cross-Equipment Comparison — Current Defect Rate</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compData.current} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#252a3a' : '#e2e5eb'} />
                  <XAxis type="number" tick={{ fontSize: 13 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="furnace" tick={{ fontSize: 13 }} width={50} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />} />
                  <ReferenceLine x={0.02} stroke="#10b981" strokeDasharray="3 3" label={{ value: '2%', position: 'top', fill: '#10b981', fontSize: 13 }} />
                  <ReferenceLine x={0.05} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '5%', position: 'top', fill: '#f59e0b', fontSize: 13 }} />
                  <Bar dataKey="defect_rate" name="Defect Rate" radius={[0, 3, 3, 0]}>
                    {compData.current.map((d: EquipmentComparisonItem, i: number) => (
                      <Cell key={i} fill={d.defect_rate > 0.05 ? '#ef4444' : d.defect_rate > 0.03 ? '#f59e0b' : '#06b6d4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendCharts({ data }: { data: EquipmentTrendsResponse }) {
  const { furnace, department, monthly, trend_line, slope, r_squared } = data;
  const { isDark } = useTheme();
  const card = useCardClass();
  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  const chartData = monthly.map((m: MonthlyEquipmentData) => ({
    month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    defect_rate: m.defect_rate * 100,
    avg_kwh: m.avg_kwh,
    avg_run_time: m.avg_run_time,
    avg_downtime: m.avg_downtime,
    avg_car_deck: m.avg_car_deck,
    run_count: m.run_count,
    defect_cost: (m as any).defect_cost || 0,
  }));

  const trendLineData = trend_line.map((t: TrendPoint) => ({
    month: new Date(t.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    trend: t.value * 100,
  }));

  const mergedData = chartData.map((d, i: number) => ({
    ...d,
    trend: trendLineData[i]?.trend ?? null,
  }));

  const trendDir = slope > 0.001 ? 'Degrading' : slope < -0.001 ? 'Improving' : 'Stable';
  const trendColor = slope > 0.001 ? 'text-danger' : slope < -0.001 ? 'text-success' : 'text-text-muted';

  return (
    <>
      {/* Header */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-bold" style={{ color: textPrimary }}>{furnace}</h3>
          <div className={`text-sm font-semibold ${trendColor}`}>{trendDir}</div>
        </div>
        <div className="text-[13px]" style={{ color: textMuted }}>{department} · R² = {r_squared.toFixed(3)} · Slope = {(slope * 100).toFixed(3)}%/mo</div>
      </div>

      {/* Defect rate trend with regression */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: textSecondary }}>Defect Rate Trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ fontSize: 13 }} />
            <YAxis tick={{ fontSize: 13 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line type="monotone" dataKey="defect_rate" name="Defect Rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="trend" name="Trend Line" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Defect Cost Trend */}
      <MetricChart data={chartData} dataKey="defect_cost" name="Monthly Defect Cost ($)" color="#f59e0b" />

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-5">
        <MetricChart data={chartData} dataKey="avg_kwh" name="Avg kWh" color="#06b6d4" />
        <MetricChart data={chartData} dataKey="avg_downtime" name="Avg Downtime (hrs)" color="#ef4444" />
        {department === 'bake' && (
          <>
            <MetricChart data={chartData} dataKey="avg_run_time" name="Avg Run Time (hrs)" color="#06b6d4" />
            <MetricChart data={chartData} dataKey="avg_car_deck" name="Avg Car Deck" color="#f59e0b" />
          </>
        )}
      </div>
    </>
  );
}

function MetricChart({ data, dataKey, name, color }: { data: Record<string, unknown>[]; dataKey: string; name: string; color: string }) {
  const { isDark } = useTheme();
  const card = useCardClass();
  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';

  return (
    <div className={`${card} p-5`}>
      <h3 className="text-[13px] font-semibold mb-3" style={{ color: textSecondary }}>{name}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="month" tick={{ fontSize: 13 }} />
          <YAxis tick={{ fontSize: 13 }} />
          <Tooltip content={<ChartTooltip formatter={(v: number) => v?.toFixed(1)} />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
