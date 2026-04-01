import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonCard, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend,
} from 'recharts';
import type { EquipmentItem, EquipmentTrendsResponse, EquipmentComparisonItem, MonthlyEquipmentData, TrendPoint } from '../types';

export default function EquipmentTrending() {
  const [department, setDepartment] = useState<string>('');
  const [selectedFurnace, setSelectedFurnace] = useState<string | null>(null);

  const { data: equipData, loading: equipLoading } = useApi(
    () => api.getEquipment(department || undefined),
    [department],
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Equipment Trending</h1>
        <div className="flex gap-2">
          {[{ v: '', l: 'All' }, { v: 'bake', l: 'Bake' }, { v: 'graphite', l: 'Graphite' }].map(d => (
            <button key={d.v} onClick={() => { setDepartment(d.v); setSelectedFurnace(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                department === d.v ? 'bg-accent text-black' : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
              }`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment list */}
        <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[13px] font-semibold text-text-secondary tracking-wide">Equipment (sorted by defect rate)</h3>
          </div>
          {equipLoading ? <div className="p-3 space-y-2">{Array.from({length: 8}).map((_, i) => <SkeletonCard key={i} height="h-12" />)}</div> : (
            <div className="max-h-[600px] overflow-y-auto">
              {equipment.map((e: EquipmentItem) => {
                const TrendIcon = e.trend_direction === 'degrading' ? TrendingUp :
                  e.trend_direction === 'improving' ? TrendingDown : Minus;
                const trendColor = e.trend_direction === 'degrading' ? 'text-danger' :
                  e.trend_direction === 'improving' ? 'text-success' : 'text-text-muted';

                return (
                  <div key={e.furnace}
                    onClick={() => setSelectedFurnace(e.furnace)}
                    className={`flex items-center justify-between px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-card-hover ${
                      selectedFurnace === e.furnace ? 'bg-[#252421] border-l-[3px] border-l-amber-500' : ''
                    }`}>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{e.furnace}</div>
                      <div className="text-xs text-text-muted">{e.department} · {e.run_count} runs/mo</div>
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
        <div className="lg:col-span-2 space-y-4">
          {selectedFurnace && trendData && !trendLoading ? (
            <TrendCharts data={trendData} />
          ) : trendLoading ? (
            <div className="space-y-4">
              <SkeletonChart height="h-48" />
              <div className="grid grid-cols-2 gap-4">
                <SkeletonChart height="h-40" />
                <SkeletonChart height="h-40" />
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl h-[300px] flex items-center justify-center text-text-muted text-sm">
              Select equipment to view trends
            </div>
          )}

          {/* Cross-equipment comparison */}
          {compData && !compLoading && (
            <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-text-secondary mb-4">Cross-Equipment Comparison — Current Defect Rate</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={compData.current} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2a2d3a" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="furnace" tick={{ fontSize: 12 }} width={50} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />} />
                  <ReferenceLine x={0.02} stroke="#10b981" strokeDasharray="3 3" label={{ value: '2%', position: 'top', fill: '#10b981', fontSize: 9 }} />
                  <ReferenceLine x={0.05} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '5%', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
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

  const chartData = monthly.map((m: MonthlyEquipmentData) => ({
    month: new Date(m.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    defect_rate: m.defect_rate * 100,
    avg_kwh: m.avg_kwh,
    avg_run_time: m.avg_run_time,
    avg_downtime: m.avg_downtime,
    avg_car_deck: m.avg_car_deck,
    run_count: m.run_count,
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
      <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-text-primary">{furnace}</h3>
          <div className={`text-sm font-medium ${trendColor}`}>{trendDir}</div>
        </div>
        <div className="text-xs text-text-muted">{department} · R² = {r_squared.toFixed(3)} · Slope = {(slope * 100).toFixed(3)}%/mo</div>
      </div>

      {/* Defect rate trend with regression */}
      <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">Defect Rate Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="defect_rate" name="Defect Rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="trend" name="Trend Line" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-4">
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
  return (
    <div className="bg-[#1a1d2b] border border-[#2a2d3a]/60 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-2">{name}</h3>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<ChartTooltip formatter={(v: number) => v?.toFixed(1)} />} />
          <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
