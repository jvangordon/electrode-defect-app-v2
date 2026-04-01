import { useState, useMemo, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import DateRangeFilter, { getInitialRange } from '../components/DateRangeFilter';
import type { DateRange } from '../components/DateRangeFilter';
import { useTheme } from '../App';
import { useLocation } from 'react-router-dom';
import { GitCompareArrows, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import type { Run, Electrode, ComparisonResult, ParamDiff, SensorReading } from '../types';

function useCardClass() {
  const { isDark } = useTheme();
  return isDark
    ? 'bg-[#141824] border border-[#252a3a] rounded-xl'
    : 'bg-white border border-[#e2e5eb] rounded-xl shadow-sm';
}

type Mode = 'compare' | 'trend';

export default function RunComparison() {
  const [department, setDepartment] = useState<'bake' | 'graphite'>('bake');
  const [furnaceFilter, setFurnaceFilter] = useState('');
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [mode, setMode] = useState<Mode>('compare');
  const [trendFurnace, setTrendFurnace] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(getInitialRange('All'));
  const { isDark } = useTheme();
  const card = useCardClass();
  const location = useLocation();

  // Pre-select run from URL query param (e.g. /comparison?run=XXX)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const runParam = params.get('run');
    if (runParam && !selectedRuns.includes(runParam)) {
      setSelectedRuns([runParam]);
    }
  }, [location.search]);

  const dateParams: Record<string, string> = {};
  if (dateRange.startDate) dateParams.start_date = dateRange.startDate;
  if (dateRange.endDate) dateParams.end_date = dateRange.endDate;

  const { data: runData, loading: runsLoading } = useApi(
    () => api.getRuns({ department, limit: '100', ...(furnaceFilter ? { furnace: furnaceFilter } : {}), ...dateParams }),
    [department, furnaceFilter, dateRange.startDate, dateRange.endDate],
  );

  // Trend mode: fetch last 30 runs for selected furnace
  const { data: trendData, loading: trendLoading } = useApi(
    () => mode === 'trend' && trendFurnace
      ? api.getRuns({ department, furnace: trendFurnace, limit: '30' })
      : Promise.resolve(null),
    [mode, department, trendFurnace],
  );

  const { data: compData, loading: compLoading } = useApi(
    () => comparing && selectedRuns.length === 2
      ? api.compareRuns(selectedRuns[0], selectedRuns[1])
      : Promise.resolve(null),
    [comparing, selectedRuns[0], selectedRuns[1]],
  );

  const runs = runData?.runs || [];
  const trendRuns = trendData?.runs || [];
  const furnaces = useMemo(() => {
    const set = new Set<string>(runs.map((r: Run) => r.furnace));
    return [...set].sort();
  }, [runs]);

  // Set default trend furnace when furnaces load
  useMemo(() => {
    if (mode === 'trend' && !trendFurnace && furnaces.length > 0) {
      setTrendFurnace(furnaces[0]);
    }
  }, [mode, furnaces, trendFurnace]);

  const toggleRun = (runNumber: string) => {
    setComparing(false);
    setSelectedRuns(prev => {
      if (prev.includes(runNumber)) return prev.filter(r => r !== runNumber);
      if (prev.length >= 2) return [prev[1], runNumber];
      return [...prev, runNumber];
    });
  };

  const startCompare = () => {
    if (selectedRuns.length === 2) setComparing(true);
  };

  const handleDotClick = (runNumber: string) => {
    toggleRun(runNumber);
    if (selectedRuns.length === 1 && !selectedRuns.includes(runNumber)) {
      // Two runs will be selected, switch to compare mode
      setTimeout(() => {
        setMode('compare');
        setComparing(true);
      }, 100);
    }
  };

  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>Run Comparison</h1>
          {/* Mode toggle — segmented control */}
          <div className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: isDark ? '#252a3a' : '#e2e5eb' }}>
            <button onClick={() => { setMode('compare'); setComparing(false); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${
                mode === 'compare'
                  ? 'bg-accent text-black'
                  : isDark ? 'bg-[#111520] text-[#9ca3af] hover:text-[#e5e7eb]' : 'bg-[#f0f1f4] text-[#4b5068] hover:text-[#1a1d2b]'
              }`}>
              <GitCompareArrows size={14} /> Compare Two
            </button>
            <button onClick={() => { setMode('trend'); setComparing(false); setSelectedRuns([]); }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${
                mode === 'trend'
                  ? 'bg-accent text-black'
                  : isDark ? 'bg-[#111520] text-[#9ca3af] hover:text-[#e5e7eb]' : 'bg-[#f0f1f4] text-[#4b5068] hover:text-[#1a1d2b]'
              }`}>
              <TrendingUp size={14} /> Furnace Trend
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter defaultPreset="All" onChange={setDateRange} />
          {(['bake', 'graphite'] as const).map(d => (
            <button key={d} onClick={() => { setDepartment(d); setSelectedRuns([]); setComparing(false); setFurnaceFilter(''); setTrendFurnace(''); }}
              className={`px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${
                department === d
                  ? 'bg-accent text-black'
                  : isDark
                  ? 'bg-[#141824] text-[#9ca3af] border border-[#252a3a] hover:text-[#e5e7eb]'
                  : 'bg-white text-[#4b5068] border border-[#e2e5eb] hover:text-[#1a1d2b]'
              }`}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
          {mode === 'compare' && (
            <select value={furnaceFilter} onChange={e => setFurnaceFilter(e.target.value)}
              className="border-2 rounded-lg px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              style={{
                background: isDark ? '#111520' : '#ffffff',
                borderColor: isDark ? '#252a3a' : '#e2e5eb',
                color: textPrimary,
              }}>
              <option value="">All furnaces</option>
              {furnaces.map((f: string) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          {mode === 'trend' && (
            <select value={trendFurnace} onChange={e => setTrendFurnace(e.target.value)}
              className="border-2 rounded-lg px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              style={{
                background: isDark ? '#111520' : '#ffffff',
                borderColor: isDark ? '#252a3a' : '#e2e5eb',
                color: textPrimary,
              }}>
              <option value="">Select furnace</option>
              {furnaces.map((f: string) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>
      </div>

      {mode === 'trend' ? (
        <FurnaceTrend
          runs={trendRuns}
          loading={trendLoading}
          furnace={trendFurnace}
          department={department}
          selectedRuns={selectedRuns}
          onDotClick={handleDotClick}
          onToggleRun={toggleRun}
          onCompare={() => { if (selectedRuns.length === 2) { setMode('compare'); setComparing(true); } }}
        />
      ) : !comparing ? (
        <>
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
              <div className="text-sm" style={{ color: textMuted }}>
                Select 2 runs to compare &middot; {selectedRuns.length}/2 selected
              </div>
              <button onClick={startCompare} disabled={selectedRuns.length !== 2}
                className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold rounded-lg bg-accent text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors">
                <GitCompareArrows size={16} /> Compare
              </button>
            </div>
            {runsLoading ? <div className="p-6"><SkeletonTable rows={8} /></div> : (
              <RunTable runs={runs} department={department} selectedRuns={selectedRuns} onToggleRun={toggleRun} />
            )}
          </div>
        </>
      ) : compLoading ? (
        <ComparisonSkeleton />
      ) : compData ? (
        <ComparisonView data={compData} department={department} onBack={() => setComparing(false)} />
      ) : (
        <div className="text-center py-8" style={{ color: textMuted }}>Failed to load comparison</div>
      )}
    </div>
  );
}

function FurnaceTrend({ runs, loading, furnace, department, selectedRuns, onDotClick, onToggleRun, onCompare }: {
  runs: Run[]; loading: boolean; furnace: string; department: string;
  selectedRuns: string[]; onDotClick: (rn: string) => void; onToggleRun: (rn: string) => void;
  onCompare: () => void;
}) {
  const { isDark } = useTheme();
  const card = useCardClass();
  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  const chartData = useMemo(() => {
    return [...runs]
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .map(r => ({
        run_number: r.run_number,
        date: new Date(r.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        defect_rate: r.defect_rate * 100,
        raw_rate: r.defect_rate,
        pieces: r.total_pieces,
        defects: r.defect_count,
        profile: r.profile,
        car_deck: r.car_deck,
        furnace: r.furnace,
        fill: r.defect_rate < 0.03 ? '#10b981' : r.defect_rate < 0.07 ? '#f59e0b' : '#FF3621',
      }));
  }, [runs]);

  if (!furnace) {
    return (
      <div className={`${card} p-12 text-center`}>
        <TrendingUp size={32} className="mx-auto mb-3 opacity-30" style={{ color: textMuted }} />
        <div className="text-sm" style={{ color: textMuted }}>Select a furnace to view its run history trend</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Trend chart */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>
            {furnace} — Defect Rate Trend (Last {runs.length} Runs)
          </h3>
          {selectedRuns.length === 2 && (
            <button onClick={onCompare}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-black hover:bg-accent/90 transition-colors">
              <GitCompareArrows size={14} /> Compare Selected
            </button>
          )}
          {selectedRuns.length > 0 && selectedRuns.length < 2 && (
            <span className="text-sm" style={{ color: textMuted }}>Click another dot to compare ({selectedRuns.length}/2)</span>
          )}
        </div>
        {loading ? (
          <SkeletonChart height="h-[350px]" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                label={{ value: 'Defect Rate (%)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: textSecondary } }}
              />
              <ZAxis range={[120, 120]} />
              <Tooltip content={<TrendTooltip selectedRuns={selectedRuns} />} />
              <Scatter
                data={chartData}
                dataKey="defect_rate"
                onClick={(data: any) => {
                  if (data?.run_number) onDotClick(data.run_number);
                }}
                cursor="pointer"
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!cx || !cy) return null;
                  const isSelected = selectedRuns.includes(payload?.run_number);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 9 : 7}
                      fill={isSelected ? '#f59e0b' : (payload?.fill || '#06b6d4')}
                      stroke={isSelected ? '#ffffff' : 'rgba(0,0,0,0.3)'}
                      strokeWidth={isSelected ? 2.5 : 1}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-sm" style={{ color: textMuted }}>No runs found for {furnace}</div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: textMuted }}>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#10b981]" /> &lt;3%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> 3-7%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#FF3621]" /> &gt;7%</span>
          <span className="ml-2">Click dots to select runs for comparison</span>
        </div>
      </div>

      {/* Mini run table */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-6 py-3" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
          <div className="text-sm font-semibold" style={{ color: textSecondary }}>Run List — {furnace}</div>
        </div>
        <RunTable runs={runs} department={department} selectedRuns={selectedRuns} onToggleRun={onToggleRun} maxHeight="max-h-[320px]" />
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload, selectedRuns }: any) {
  const { isDark } = useTheme();
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const isSelected = selectedRuns?.includes(d.run_number);

  return (
    <div className="rounded-lg px-4 py-3 text-sm shadow-xl border"
      style={{
        background: isDark ? '#141824' : '#ffffff',
        borderColor: isDark ? '#252a3a' : '#e2e5eb',
      }}>
      <div className="font-mono font-semibold mb-1" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>
        {d.run_number} {isSelected && '✓'}
      </div>
      <div className="space-y-0.5 text-xs" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>
        <div>Date: {d.date}</div>
        <div>Pieces: {d.pieces} · Defects: {d.defects}</div>
        <div>Defect Rate: <span className="font-semibold" style={{ color: d.fill }}>{d.defect_rate.toFixed(1)}%</span></div>
        {d.profile && <div>Profile: {d.profile}</div>}
        {d.car_deck && <div>Car Deck: {d.car_deck}</div>}
      </div>
    </div>
  );
}

function RunTable({ runs, department, selectedRuns, onToggleRun, maxHeight = 'max-h-[520px]' }: {
  runs: Run[]; department: string; selectedRuns: string[]; onToggleRun: (rn: string) => void; maxHeight?: string;
}) {
  const { isDark } = useTheme();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <div className={`${maxHeight} overflow-y-auto`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" style={{
          background: isDark ? '#0f1320' : '#f8f9fb',
          borderBottom: `2px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
        }}>
          <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
            <th className="px-5 py-4 text-left w-8"></th>
            <th className="px-5 py-4 text-left">Run</th>
            <th className="px-5 py-4 text-left">Furnace</th>
            <th className="px-5 py-4 text-left">Date</th>
            <th className="px-5 py-4 text-right">Pieces</th>
            <th className="px-5 py-4 text-right">Defects</th>
            <th className="px-5 py-4 text-right">Rate</th>
            {department === 'bake' && <th className="px-5 py-4 text-right">Car Deck</th>}
            {department === 'graphite' && <th className="px-5 py-4 text-center">Risk</th>}
            <th className="px-5 py-4 text-right">kWh</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r: Run, idx: number) => {
            const isSelected = selectedRuns.includes(r.run_number);
            const rowColor = r.defect_rate > 0.1 ? 'bg-danger-dim/30' :
              r.defect_rate > 0.06 ? 'bg-warning-dim/30' : '';
            return (
              <tr key={r.run_number} onClick={() => onToggleRun(r.run_number)}
                className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${rowColor} ${
                  isSelected ? 'ring-1 ring-inset ring-accent/50 bg-accent-glow' : ''
                } ${idx % 2 === 1 && !isSelected && !rowColor ? 'bg-white/[0.02]' : ''}`}
                style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                <td className="px-5 py-4">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'border-accent bg-accent' : isDark ? 'border-[#252a3a]' : 'border-[#d0d3db]'
                  }`}>
                    {isSelected && <span className="text-black text-xs font-bold">
                      {selectedRuns.indexOf(r.run_number) + 1}
                    </span>}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono" style={{ color: textPrimary }}>{r.run_number}</td>
                <td className="px-5 py-4" style={{ color: textSecondary }}>{r.furnace}</td>
                <td className="px-5 py-4" style={{ color: textSecondary }}>
                  {r.start_time ? new Date(r.start_time).toLocaleDateString() : '-'}
                </td>
                <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{r.total_pieces}</td>
                <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{r.defect_count}</td>
                <td className="px-5 py-4 text-right"><DefectRateBadge rate={r.defect_rate} /></td>
                {department === 'bake' && (
                  <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{r.car_deck}</td>
                )}
                {department === 'graphite' && (
                  <td className="px-5 py-4 text-center">
                    {r.risk_score && <StatusBadge status={r.risk_score} />}
                  </td>
                )}
                <td className="px-5 py-4 text-right font-mono" style={{ color: textSecondary }}>
                  {r.actual_kwh?.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonView({ data, department, onBack }: { data: ComparisonResult; department: string; onBack: () => void }) {
  const { run_a, run_b, electrodes_a, electrodes_b, param_diff, sensors_a, sensors_b } = data;
  const { isDark } = useTheme();
  const card = useCardClass();
  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  const sensorTags = useMemo(() => {
    const tags = new Set<string>();
    sensors_a.forEach((s: SensorReading) => tags.add(s.tag_name));
    sensors_b.forEach((s: SensorReading) => tags.add(s.tag_name));
    return Array.from(tags).slice(0, 4);
  }, [sensors_a, sensors_b]);

  const [activeTag, setActiveTag] = useState(sensorTags[0] || '');

  const sensorChartData = useMemo(() => {
    if (!activeTag) return [];
    const aData = sensors_a.filter((s: SensorReading) => s.tag_name === activeTag);
    const bData = sensors_b.filter((s: SensorReading) => s.tag_name === activeTag);
    const maxLen = Math.max(aData.length, bData.length);
    return Array.from({ length: maxLen }).map((_, i) => ({
      idx: i,
      minutes: aData[i]?.minutes_from_start || bData[i]?.minutes_from_start || i,
      [run_a.run_number]: aData[i]?.value ?? null,
      [run_b.run_number]: bData[i]?.value ?? null,
    }));
  }, [activeTag, sensors_a, sensors_b, run_a, run_b]);

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="text-sm text-accent hover:underline flex items-center gap-1">
        ← Back to run list
      </button>

      <div className="grid grid-cols-2 gap-5">
        <RunHeader run={run_a} label="Run A" electrodes={electrodes_a} />
        <RunHeader run={run_b} label="Run B" electrodes={electrodes_b} />
      </div>

      {/* Parameter diff */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
          <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>Parameter Comparison</h3>
        </div>
        <table className="w-full text-sm">
          <thead style={{
            background: isDark ? '#0f1320' : '#f8f9fb',
            borderBottom: `2px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
          }}>
            <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
              <th className="px-5 py-4 text-left">Parameter</th>
              <th className="px-5 py-4 text-right">Run A</th>
              <th className="px-5 py-4 text-right">Run B</th>
              <th className="px-5 py-4 text-right">Deviation</th>
            </tr>
          </thead>
          <tbody>
            {param_diff.map((p: ParamDiff, idx: number) => (
              <tr key={p.parameter} className={`hover:bg-white/[0.04] ${p.significant ? 'bg-warning-dim/20' : idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                <td className="px-5 py-4" style={{ color: textSecondary }}>{formatParamName(p.parameter)}</td>
                <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{formatValue(p.run_a)}</td>
                <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{formatValue(p.run_b)}</td>
                <td className="px-5 py-4 text-right">
                  {p.deviation_pct !== null ? (
                    <span className={`font-mono ${
                      Math.abs(p.deviation_pct) > 50 ? 'text-red-400 font-semibold' :
                      Math.abs(p.deviation_pct) > 20 ? 'text-amber-400' :
                      'text-text-muted'
                    }`}>
                      {p.deviation_pct}%
                    </span>
                  ) : <span style={{ color: textMuted }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Position Maps */}
      <div className="grid grid-cols-2 gap-5">
        <PositionMap electrodes={electrodes_a} department={department} run={run_a} label="Run A" />
        <PositionMap electrodes={electrodes_b} department={department} run={run_b} label="Run B" />
      </div>

      {/* Sensor overlay */}
      {sensorTags.length > 0 && (
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>Sensor Data Overlay</h3>
            <div className="flex gap-2">
              {sensorTags.map(tag => (
                <button key={tag} onClick={() => setActiveTag(tag)}
                  className={`px-4 py-2.5 text-sm rounded-lg transition-colors ${
                    activeTag === tag ? 'bg-accent text-black font-semibold' :
                    isDark ? 'bg-[#111520] text-[#6b7280] border border-[#252a3a] hover:text-[#e5e7eb]'
                    : 'bg-[#f0f1f4] text-[#4b5068] border border-[#e2e5eb] hover:text-[#1a1d2b]'
                  }`}>
                  {tag.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          {sensorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sensorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="minutes" tick={{ fontSize: 13 }} label={{ value: 'Minutes from start', position: 'insideBottom', offset: -5, style: { fontSize: 13, fill: textSecondary } }} />
                <YAxis tick={{ fontSize: 13 }} />
                <Tooltip content={<ChartTooltip formatter={(v: number) => v?.toFixed(3)} />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey={run_a.run_number} stroke="#f59e0b" dot={false} strokeWidth={1.5} name={`${run_a.run_number}`} />
                <Line type="monotone" dataKey={run_b.run_number} stroke="#06b6d4" dot={false} strokeWidth={1.5} name={`${run_b.run_number}`} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-sm" style={{ color: textMuted }}>No sensor data available</div>
          )}
        </div>
      )}
    </div>
  );
}

function RunHeader({ run, label, electrodes }: { run: Run; label: string; electrodes: Electrode[] }) {
  const { isDark } = useTheme();
  const card = useCardClass();
  const defective = electrodes.filter((e: Electrode) => e.defect_code_ob || e.defect_code_og || e.defect_code_of);

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>{label}</span>
        <DefectRateBadge rate={run.defect_rate} />
      </div>
      <div className="font-mono text-xl font-semibold" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{run.run_number}</div>
      <div className="text-sm mt-1" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>{run.furnace} &middot; {run.department}</div>
      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
        <div>
          <div className="text-[13px]" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>Pieces</div>
          <div className="font-mono text-base mt-0.5" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{run.total_pieces}</div>
        </div>
        <div>
          <div className="text-[13px]" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>Defects</div>
          <div className="font-mono text-base text-danger mt-0.5">{defective.length}</div>
        </div>
        <div>
          <div className="text-[13px]" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>kWh</div>
          <div className="font-mono text-base mt-0.5" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>{run.actual_kwh?.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function PositionMap({ electrodes, department, run, label }: { electrodes: Electrode[]; department: string; run: Run; label: string }) {
  const { isDark } = useTheme();
  const card = useCardClass();

  const positions = department === 'graphite'
    ? electrodes.map((e: Electrode) => ({
        pos: e.position_og || 0,
        gpn: e.gpn,
        defect: !!(e.defect_code_og || e.defect_code_of),
        defect_code: e.defect_code_og || e.defect_code_of || null,
        lot: e.lot,
      }))
    : electrodes.map((e: Electrode) => ({
        pos: e.load_order_ob || 0,
        gpn: e.gpn,
        defect: !!e.defect_code_ob,
        defect_code: e.defect_code_ob || null,
        lot: e.lot,
      }));

  const maxPos = Math.max(...positions.map(p => p.pos), 14);
  const cols = department === 'graphite' ? 7 : Math.min(10, Math.ceil(Math.sqrt(maxPos)));

  return (
    <div className={`${card} p-6`}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: isDark ? '#9ca3af' : '#4b5068' }}>
        {label} Position Map — {run.furnace}
      </h3>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: maxPos }).map((_, i) => {
          const pos = i + 1;
          const elec = positions.find(p => p.pos === pos);
          if (!elec) {
            return (
              <div key={pos} className="aspect-square rounded-lg flex items-center justify-center text-[13px]"
                style={{
                  background: isDark ? '#111520' : '#f0f1f4',
                  border: `1px solid ${isDark ? '#252a3a80' : '#d0d3db'}`,
                  color: isDark ? '#6b7280' : '#8b8fa3',
                }}>
                {pos}
              </div>
            );
          }
          return (
            <div key={pos}
              className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-[13px] transition-colors ${
                elec.defect
                  ? 'bg-danger-dim border-danger/40 text-danger'
                  : 'bg-success-dim border-success/30 text-success'
              }`}
              title={`Pos ${pos}: ${elec.gpn}\n${elec.defect ? `Defect: ${elec.defect_code}` : 'Clean'}\nLot: ${elec.lot}`}
            >
              <span className="font-bold">{pos}</span>
              {elec.defect && <span className="text-xs mt-0.5">{elec.defect_code}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-[13px]" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success"></span> Clean</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-danger"></span> Defect</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border" style={{ borderColor: isDark ? '#252a3a' : '#d0d3db', background: isDark ? '#111520' : '#f0f1f4' }}></span> Empty</span>
      </div>
    </div>
  );
}

function formatParamName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val: string | number | null): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(val);
}

function ComparisonSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <SkeletonChart height="h-36" />
        <SkeletonChart height="h-36" />
      </div>
      <SkeletonTable rows={8} />
      <div className="grid grid-cols-2 gap-5">
        <SkeletonChart height="h-52" />
        <SkeletonChart height="h-52" />
      </div>
    </div>
  );
}
