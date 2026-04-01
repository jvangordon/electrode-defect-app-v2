import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import { AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ScatterChart, Scatter, Cell,
} from 'recharts';
import type { BakeAnomaly, Deviation, GraphiteAssessment, Quintile, CompositionElectrode } from '../types';

export default function AnomalyDetection() {
  const [tab, setTab] = useState<'bake' | 'graphite'>('bake');

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Anomaly Detection</h1>
        <div className="flex gap-2">
          {(['bake', 'graphite'] as const).map(d => (
            <button key={d} onClick={() => setTab(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                tab === d ? 'bg-accent text-black' : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
              }`}>
              {d === 'bake' ? 'Bake — SPC' : 'Graphite — Composition Risk'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'bake' ? <BakeAnomalies /> : <GraphiteRisk />}
    </div>
  );
}

function BakeAnomalies() {
  const { data, loading } = useApi(() => api.getBakeAnomalies(100), []);

  if (loading) return <div className="space-y-4"><SkeletonChart /><SkeletonTable rows={8} /></div>;
  if (!data) return null;

  const { anomalies, population_stats, spc_data } = data;
  const flagged = anomalies.filter((a: BakeAnomaly) => a.is_anomaly);

  // SPC chart data for car_deck
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
    <div className="space-y-4">
      {/* SPC Control Chart */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-secondary">SPC Control Chart — Car Deck Position</h3>
          <div className="flex items-center gap-4 text-[10px] text-text-muted">
            <span>Mean: <span className="font-mono text-text-primary">{meanDeck.toFixed(1)}</span></span>
            <span>UCL (+2σ): <span className="font-mono text-danger">{(meanDeck + 2 * stdDeck).toFixed(1)}</span></span>
            <span>LCL (-2σ): <span className="font-mono text-success">{(meanDeck - 2 * stdDeck).toFixed(1)}</span></span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="idx" tick={{ fontSize: 10 }} label={{ value: 'Run sequence', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#9ca3af' } }} />
            <YAxis dataKey="car_deck" domain={[0, 10]} tick={{ fontSize: 10 }} label={{ value: 'Car Deck', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#9ca3af' } }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-bg-card border border-border-light rounded-lg px-3 py-2 shadow-lg text-xs">
                  <div className="font-mono text-text-primary">{d.run}</div>
                  <div className="text-text-muted">{d.furnace} — {d.date}</div>
                  <div className="mt-1">Car Deck: <span className="font-mono">{d.car_deck}</span></div>
                  <div>Defect Rate: <span className="font-mono">{d.defect_rate.toFixed(1)}%</span></div>
                </div>
              );
            }} />
            <ReferenceLine y={meanDeck} stroke="#9ca3af" strokeDasharray="5 5" label={{ value: 'Mean', position: 'right', fill: '#9ca3af', fontSize: 10 }} />
            <ReferenceLine y={meanDeck + 2 * stdDeck} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'UCL', position: 'right', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={Math.max(0, meanDeck - 2 * stdDeck)} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'LCL', position: 'right', fill: '#10b981', fontSize: 10 }} />
            <Scatter data={spcChartData} fill="#f59e0b">
              {spcChartData.map((d, i: number) => (
                <Cell key={i} fill={d.car_deck > meanDeck + 2 * stdDeck ? '#ef4444' : d.car_deck > meanDeck + stdDeck ? '#f59e0b' : '#06b6d4'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Defect Rate SPC */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Defect Rate by Run (Bake)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={spcChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} />
            <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '5%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '10%', position: 'right', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="defect_rate" name="Defect Rate" stroke="#06b6d4" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flagged runs table */}
      <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          <h3 className="text-sm font-medium text-text-secondary">Flagged Anomalous Runs ({flagged.length})</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-card border-b border-border">
              <tr className="text-text-muted uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Run</th>
                <th className="px-3 py-2 text-left">Furnace</th>
                <th className="px-3 py-2 text-center">Severity</th>
                <th className="px-3 py-2 text-right">Car Deck</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-left">Deviations</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((a: BakeAnomaly) => (
                <tr key={a.run_number} className="border-b border-border/50 hover:bg-bg-card-hover">
                  <td className="px-3 py-2 font-mono text-text-primary">{a.run_number}</td>
                  <td className="px-3 py-2 text-text-secondary">{a.furnace}</td>
                  <td className="px-3 py-2 text-center">{a.severity && <StatusBadge status={a.severity} />}</td>
                  <td className="px-3 py-2 text-right font-mono">{a.car_deck}</td>
                  <td className="px-3 py-2 text-right"><DefectRateBadge rate={a.defect_rate} /></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {a.deviations.map((d: Deviation, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bg-input text-text-secondary">
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

  if (loading) return <div className="space-y-4"><SkeletonChart /><SkeletonTable rows={8} /></div>;
  if (!data) return null;

  const { assessments, quintiles } = data;

  // Quintile distribution
  const quintileCounts = quintiles.map((q: Quintile) => ({
    ...q,
    count: assessments.filter((a: GraphiteAssessment) => a.risk_score === q.quintile).length,
  }));

  const QUINTILE_COLORS: Record<string, string> = {
    Q1: '#10b981', Q2: '#6ee7b7', Q3: '#f59e0b', Q4: '#f97316', Q5: '#ef4444',
  };

  const selected = selectedRun ? assessments.find((a: GraphiteAssessment) => a.run_number === selectedRun) : null;

  return (
    <div className="space-y-4">
      {/* Quintile reference */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Composition Risk Quintiles</h3>
        <div className="grid grid-cols-5 gap-2">
          {quintileCounts.map((q) => (
            <div key={q.quintile}
              className="p-3 rounded-lg border text-center"
              style={{ borderColor: QUINTILE_COLORS[q.quintile] + '40', background: QUINTILE_COLORS[q.quintile] + '10' }}>
              <div className="text-lg font-bold font-mono" style={{ color: QUINTILE_COLORS[q.quintile] }}>{q.quintile}</div>
              <div className="text-[10px] text-text-muted mt-1">Avg Rate</div>
              <div className="font-mono text-sm text-text-primary">{(q.avg_defect_rate * 100).toFixed(1)}%</div>
              <div className="text-[10px] text-text-muted mt-1">P(High Event)</div>
              <div className="font-mono text-sm text-text-primary">{(q.probability_high_defect_event * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-text-muted mt-2">{q.count} runs</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assessments table */}
        <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h3 className="text-sm font-medium text-text-secondary">Graphite Runs — Risk Assessment</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-card border-b border-border">
                <tr className="text-text-muted uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">Run</th>
                  <th className="px-3 py-2 text-left">Furnace</th>
                  <th className="px-3 py-2 text-center">Risk</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Hi-Risk Lots</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a: GraphiteAssessment) => (
                  <tr key={a.run_number} onClick={() => setSelectedRun(a.run_number)}
                    className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-card-hover ${
                      selectedRun === a.run_number ? 'bg-accent-glow' : ''
                    }`}>
                    <td className="px-3 py-2 font-mono text-text-primary">{a.run_number}</td>
                    <td className="px-3 py-2 text-text-secondary">{a.furnace}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={a.risk_score || 'no_data'} /></td>
                    <td className="px-3 py-2 text-right"><DefectRateBadge rate={a.defect_rate} /></td>
                    <td className="px-3 py-2 text-right font-mono">
                      {a.composition?.high_risk_lot_count || 0}/{a.composition?.total_electrodes || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected run detail */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text-secondary">
                  Composition: {selected.run_number}
                </h3>
                <StatusBadge status={selected.risk_score || 'no_data'} size="md" />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="bg-bg-input rounded p-2">
                  <div className="text-text-muted">High-Risk Lots</div>
                  <div className="font-mono text-lg text-text-primary">{selected.composition?.high_risk_lot_count}</div>
                </div>
                <div className="bg-bg-input rounded p-2">
                  <div className="text-text-muted">Edge Positions</div>
                  <div className="font-mono text-lg text-text-primary">{selected.composition?.edge_position_count}</div>
                </div>
                <div className="bg-bg-input rounded p-2">
                  <div className="text-text-muted">Avg Lot Risk</div>
                  <div className="font-mono text-lg text-text-primary">{((selected.composition?.avg_lot_defect_rate || 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
              {/* Electrode list */}
              <div className="text-xs space-y-1 max-h-[300px] overflow-y-auto">
                <div className="flex text-text-muted uppercase tracking-wider px-2 py-1">
                  <span className="w-8">Pos</span>
                  <span className="flex-1">Lot</span>
                  <span className="w-16 text-right">Lot Risk</span>
                  <span className="w-20 text-center">Defect</span>
                </div>
                {selected.composition?.electrodes?.map((e: CompositionElectrode) => (
                  <div key={e.gpn} className={`flex items-center px-2 py-1 rounded ${
                    e.defect_code_og || e.defect_code_of ? 'bg-danger-dim/30' : ''
                  }`}>
                    <span className="w-8 font-mono">{e.position_og}</span>
                    <span className="flex-1 text-text-secondary">
                      {e.lot}
                      {e.risk_tier === 'high' && <span className="ml-1 text-danger">●</span>}
                    </span>
                    <span className="w-16 text-right font-mono">{((e.lot_defect_rate || 0) * 100).toFixed(1)}%</span>
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
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              Select a run to view composition breakdown
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
