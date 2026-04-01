import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import DateRangeFilter, { getInitialRange } from '../components/DateRangeFilter';
import type { DateRange } from '../components/DateRangeFilter';
import { useTheme } from '../App';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ScatterChart, Scatter, Cell,
} from 'recharts';
import type { BakeAnomaly, Deviation, GraphiteAssessment, Quintile, CompositionElectrode } from '../types';

function useCardClass() {
  const { isDark } = useTheme();
  return isDark
    ? 'bg-[#141824] border border-[#252a3a] rounded-xl'
    : 'bg-white border border-[#e2e5eb] rounded-xl shadow-sm';
}

export default function AnomalyDetection() {
  const [tab, setTab] = useState<'bake' | 'graphite'>('bake');
  const [dateRange, setDateRange] = useState<DateRange>(getInitialRange('All'));
  const { isDark } = useTheme();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';

  const dateParams: Record<string, string> = {};
  if (dateRange.startDate) dateParams.start_date = dateRange.startDate;
  if (dateRange.endDate) dateParams.end_date = dateRange.endDate;

  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>Anomaly Detection</h1>
        <div className="flex items-center gap-3">
          <DateRangeFilter defaultPreset="All" onChange={setDateRange} />
          {(['bake', 'graphite'] as const).map(d => (
            <button key={d} onClick={() => setTab(d)}
              className={`px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${
                tab === d ? 'bg-accent text-black' :
                isDark ? 'bg-[#141824] text-[#9ca3af] border border-[#252a3a] hover:text-[#e5e7eb]'
                : 'bg-white text-[#4b5068] border border-[#e2e5eb] hover:text-[#1a1d2b]'
              }`}>
              {d === 'bake' ? 'Bake — SPC' : 'Graphite — Composition Risk'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'bake' ? <BakeAnomalies dateParams={dateParams} /> : <GraphiteRisk />}
    </div>
  );
}

function BakeAnomalies({ dateParams }: { dateParams: Record<string, string> }) {
  const { data, loading } = useApi(
    () => api.getBakeAnomalies(100, Object.keys(dateParams).length ? dateParams : undefined),
    [dateParams.start_date, dateParams.end_date],
  );
  const { isDark } = useTheme();
  const card = useCardClass();
  const gridStroke = isDark ? '#252a3a' : '#e2e5eb';
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  if (loading) return <div className="space-y-8"><SkeletonChart /><SkeletonTable rows={8} /></div>;
  if (!data) return null;

  const { anomalies, population_stats, spc_data } = data;
  const flagged = anomalies.filter((a: BakeAnomaly) => a.is_anomaly);

  const spcChartData = spc_data.map((d, i: number) => ({
    idx: i,
    date: d.start_time ? new Date(d.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    car_deck: d.car_deck,
    defect_rate: d.defect_rate * 100,
    furnace: d.furnace,
    run: d.run_number,
  }));

  const meanDeck = population_stats.mean_deck || 0;
  const stdDeck = population_stats.std_deck || 0;

  return (
    <div className="space-y-8">
      {/* SPC Control Chart */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>SPC Control Chart — Car Deck Position</h3>
          <div className="flex items-center gap-4 text-[13px]" style={{ color: textMuted }}>
            <span>Mean: <span className="font-mono" style={{ color: textPrimary }}>{meanDeck.toFixed(1)}</span></span>
            <span>UCL (+2σ): <span className="font-mono text-danger">{(meanDeck + 2 * stdDeck).toFixed(1)}</span></span>
            <span>LCL (-2σ): <span className="font-mono text-success">{(meanDeck - 2 * stdDeck).toFixed(1)}</span></span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="idx" tick={{ fontSize: 13 }} label={{ value: 'Run sequence', position: 'insideBottom', offset: -5, style: { fontSize: 13, fill: textSecondary } }} />
            <YAxis dataKey="car_deck" domain={[0, 10]} tick={{ fontSize: 13 }} label={{ value: 'Car Deck', angle: -90, position: 'insideLeft', style: { fontSize: 13, fill: textSecondary } }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg px-4 py-3 shadow-lg text-[13px]" style={{
                  background: isDark ? '#141824' : '#ffffff',
                  border: `1px solid ${isDark ? '#353849' : '#e2e5eb'}`,
                }}>
                  <div className="font-mono" style={{ color: textPrimary }}>{d.run}</div>
                  <div style={{ color: textMuted }}>{d.furnace} — {d.date}</div>
                  <div className="mt-1">Car Deck: <span className="font-mono">{d.car_deck}</span></div>
                  <div>Defect Rate: <span className="font-mono">{d.defect_rate.toFixed(1)}%</span></div>
                </div>
              );
            }} />
            <ReferenceLine y={meanDeck} stroke="#9ca3af" strokeDasharray="5 5" label={{ value: 'Mean', position: 'right', fill: '#9ca3af', fontSize: 13 }} />
            <ReferenceLine y={meanDeck + 2 * stdDeck} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'UCL', position: 'right', fill: '#ef4444', fontSize: 13 }} />
            <ReferenceLine y={Math.max(0, meanDeck - 2 * stdDeck)} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'LCL', position: 'right', fill: '#10b981', fontSize: 13 }} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Scatter data={spcChartData} fill="#f59e0b" shape={(props: any) => {
              const { cx, cy, fill: cellFill } = props;
              return <circle cx={cx} cy={cy} r={5} fill={cellFill} />;
            }}>
              {spcChartData.map((d, i: number) => (
                <Cell key={i} fill={d.car_deck > meanDeck + 2 * stdDeck ? '#ef4444' : d.car_deck > meanDeck + stdDeck ? '#f59e0b' : '#06b6d4'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Defect Rate SPC */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: textSecondary }}>Defect Rate by Run (Bake)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={spcChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="idx" tick={{ fontSize: 13 }} />
            <YAxis tick={{ fontSize: 13 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '5%', position: 'right', fill: '#f59e0b', fontSize: 13 }} />
            <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '10%', position: 'right', fill: '#ef4444', fontSize: 13 }} />
            <Line type="monotone" dataKey="defect_rate" name="Defect Rate" stroke="#06b6d4" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flagged runs table */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
          <AlertTriangle size={16} className="text-warning" />
          <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>Flagged Anomalous Runs ({flagged.length})</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" style={{
              background: isDark ? '#0f1320' : '#f8f9fb',
              borderBottom: `2px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
            }}>
              <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                <th className="px-5 py-4 text-left">Run</th>
                <th className="px-5 py-4 text-left">Furnace</th>
                <th className="px-5 py-4 text-center">Severity</th>
                <th className="px-5 py-4 text-right">Car Deck</th>
                <th className="px-5 py-4 text-right pr-6">Rate</th>
                <th className="px-5 py-4 text-left pl-6">Deviations</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((a: BakeAnomaly, idx: number) => (
                <tr key={a.run_number} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                  style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                  <td className="px-5 py-4 font-mono" style={{ color: textPrimary }}>{a.run_number}</td>
                  <td className="px-5 py-4" style={{ color: textSecondary }}>{a.furnace}</td>
                  <td className="px-5 py-4 text-center">{a.severity && <StatusBadge status={a.severity} />}</td>
                  <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{a.car_deck}</td>
                  <td className="px-5 py-4 text-right"><DefectRateBadge rate={a.defect_rate} /></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {a.deviations.map((d: Deviation, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[13px] px-2.5 py-1 rounded"
                          style={{
                            background: isDark ? '#111520' : '#f0f1f4',
                            color: textSecondary,
                          }}>
                          {d.parameter.replace(/_/g, ' ')}: <span className="font-mono text-warning">{d.z_score}σ</span> {d.direction}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GraphiteRisk() {
  const { data, loading } = useApi(() => api.getGraphiteRisk(80), []);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const { isDark } = useTheme();
  const card = useCardClass();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  if (loading) return <div className="space-y-8"><SkeletonChart /><SkeletonTable rows={8} /></div>;
  if (!data) return null;

  const { assessments, quintiles } = data;

  const quintileCounts = quintiles.map((q: Quintile) => ({
    ...q,
    count: assessments.filter((a: GraphiteAssessment) => a.risk_score === q.quintile).length,
  }));

  const QUINTILE_COLORS: Record<string, string> = {
    Q1: '#10b981', Q2: '#6ee7b7', Q3: '#f59e0b', Q4: '#f97316', Q5: '#ef4444',
  };

  const selected = selectedRun ? assessments.find((a: GraphiteAssessment) => a.run_number === selectedRun) : null;

  return (
    <div className="space-y-8">
      {/* Quintile reference */}
      <div className={`${card} p-6`}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: textSecondary }}>Composition Risk Quintiles</h3>
        <div className="grid grid-cols-5 gap-5">
          {quintileCounts.map((q) => (
            <div key={q.quintile}
              className="p-5 rounded-xl border text-center"
              style={{ borderColor: QUINTILE_COLORS[q.quintile] + '40', background: QUINTILE_COLORS[q.quintile] + '10' }}>
              <div className="text-2xl font-bold font-mono" style={{ color: QUINTILE_COLORS[q.quintile] }}>{q.quintile}</div>
              <div className="text-[13px] mt-2" style={{ color: textMuted }}>Avg Rate</div>
              <div className="font-mono text-sm" style={{ color: textPrimary }}>{(q.avg_defect_rate * 100).toFixed(1)}%</div>
              <div className="text-[13px] mt-2" style={{ color: textMuted }}>P(High Event)</div>
              <div className="font-mono text-sm" style={{ color: textPrimary }}>{(q.probability_high_defect_event * 100).toFixed(0)}%</div>
              <div className="text-[13px] mt-2" style={{ color: textMuted }}>{q.count} runs</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Assessments table */}
        <div className={`${card} overflow-hidden`}>
          <div className="px-6 py-4" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
            <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>Graphite Runs — Risk Assessment</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" style={{
                background: isDark ? '#0f1320' : '#f8f9fb',
                borderBottom: `2px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
              }}>
                <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  <th className="px-5 py-4 text-left">Run</th>
                  <th className="px-5 py-4 text-left">Furnace</th>
                  <th className="px-5 py-4 text-center">Risk</th>
                  <th className="px-5 py-4 text-right">Rate</th>
                  <th className="px-5 py-4 text-right">Hi-Risk Lots</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a: GraphiteAssessment, idx: number) => (
                  <tr key={a.run_number} onClick={() => setSelectedRun(a.run_number)}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${
                      selectedRun === a.run_number ? 'bg-accent-glow' : idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                    }`}
                    style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                    <td className="px-5 py-4 font-mono" style={{ color: textPrimary }}>{a.run_number}</td>
                    <td className="px-5 py-4" style={{ color: textSecondary }}>{a.furnace}</td>
                    <td className="px-5 py-4 text-center"><StatusBadge status={a.risk_score || 'no_data'} /></td>
                    <td className="px-5 py-4 text-right"><DefectRateBadge rate={a.defect_rate} /></td>
                    <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>
                      {a.composition?.high_risk_lot_count || 0}/{a.composition?.total_electrodes || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected run detail */}
        <div className={`${card} p-6`}>
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>
                  Composition: {selected.run_number}
                </h3>
                <StatusBadge status={selected.risk_score || 'no_data'} size="md" />
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5 text-sm">
                <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                  <div className="text-[13px]" style={{ color: textMuted }}>High-Risk Lots</div>
                  <div className="font-mono text-xl font-semibold mt-1" style={{ color: textPrimary }}>{selected.composition?.high_risk_lot_count}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                  <div className="text-[13px]" style={{ color: textMuted }}>Edge Positions</div>
                  <div className="font-mono text-xl font-semibold mt-1" style={{ color: textPrimary }}>{selected.composition?.edge_position_count}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                  <div className="text-[13px]" style={{ color: textMuted }}>Avg Lot Risk</div>
                  <div className="font-mono text-xl font-semibold mt-1" style={{ color: textPrimary }}>{((selected.composition?.avg_lot_defect_rate || 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
              {/* Electrode list */}
              <div className="text-sm space-y-1 max-h-[300px] overflow-y-auto">
                <div className="flex text-xs uppercase tracking-wider px-4 py-2.5 font-semibold" style={{ color: textMuted }}>
                  <span className="w-12">Pos</span>
                  <span className="flex-1">Lot</span>
                  <span className="w-20 text-right">Lot Risk</span>
                  <span className="w-20 text-center">Defect</span>
                </div>
                {selected.composition?.electrodes?.map((e: CompositionElectrode) => (
                  <div key={e.gpn} className={`flex items-center px-4 py-2.5 rounded ${
                    e.defect_code_og || e.defect_code_of ? 'bg-danger-dim/30' : ''
                  }`}>
                    <span className="w-12 font-mono" style={{ color: textPrimary }}>{e.position_og}</span>
                    <span className="flex-1" style={{ color: textSecondary }}>
                      {e.lot}
                      {e.risk_tier === 'high' && <span className="ml-1 text-danger">●</span>}
                    </span>
                    <span className="w-20 text-right font-mono" style={{ color: textPrimary }}>{((e.lot_defect_rate || 0) * 100).toFixed(1)}%</span>
                    <span className="w-20 text-center">
                      {(e.defect_code_og || e.defect_code_of) ? (
                        <StatusBadge status="defect" />
                      ) : (
                        <StatusBadge status="clean" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: textMuted }}>
              Select a run to view composition breakdown
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
