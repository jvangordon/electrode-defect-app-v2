import { useState, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonChart } from '../components/LoadingSkeleton';
import StatusBadge, { DefectRateBadge } from '../components/StatusBadge';
import ChartTooltip from '../components/ChartTooltip';
import { GitCompareArrows } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { Run, Electrode, ComparisonResult, ParamDiff, SensorReading } from '../types';

export default function RunComparison() {
  const [department, setDepartment] = useState<'bake' | 'graphite'>('bake');
  const [furnaceFilter, setFurnaceFilter] = useState('');
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const { data: runData, loading: runsLoading } = useApi(
    () => api.getRuns({ department, limit: '100', ...(furnaceFilter ? { furnace: furnaceFilter } : {}) }),
    [department, furnaceFilter],
  );

  const { data: compData, loading: compLoading } = useApi(
    () => comparing && selectedRuns.length === 2
      ? api.compareRuns(selectedRuns[0], selectedRuns[1])
      : Promise.resolve(null),
    [comparing, selectedRuns[0], selectedRuns[1]],
  );

  const runs = runData?.runs || [];
  const furnaces = useMemo(() => {
    const set = new Set<string>(runs.map((r: Run) => r.furnace));
    return [...set].sort();
  }, [runs]);

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

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Run Comparison</h1>
        <div className="flex items-center gap-3">
          {/* Department tabs */}
          {(['bake', 'graphite'] as const).map(d => (
            <button key={d} onClick={() => { setDepartment(d); setSelectedRuns([]); setComparing(false); setFurnaceFilter(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                department === d
                  ? 'bg-accent text-black'
                  : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
              }`}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
          {/* Furnace filter */}
          <select value={furnaceFilter} onChange={e => setFurnaceFilter(e.target.value)}
            className="bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary">
            <option value="">All furnaces</option>
            {furnaces.map((f: string) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {!comparing ? (
        <>
          {/* Run selection table */}
          <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-sm text-text-muted">
                Select 2 runs to compare &middot; {selectedRuns.length}/2 selected
              </div>
              <button onClick={startCompare} disabled={selectedRuns.length !== 2}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors">
                <GitCompareArrows size={16} /> Compare
              </button>
            </div>
            {runsLoading ? <div className="p-4"><SkeletonTable rows={8} /></div> : (
              <div className="max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-bg-card border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                    <tr className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <th className="px-4 py-3 text-left w-8"></th>
                      <th className="px-4 py-3 text-left">Run</th>
                      <th className="px-4 py-3 text-left">Furnace</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Pieces</th>
                      <th className="px-4 py-3 text-right">Defects</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      {department === 'bake' && <th className="px-4 py-3 text-right">Car Deck</th>}
                      {department === 'graphite' && <th className="px-4 py-3 text-center">Risk</th>}
                      <th className="px-4 py-3 text-right">kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r: Run, idx: number) => {
                      const isSelected = selectedRuns.includes(r.run_number);
                      const rowColor = r.defect_rate > 0.1 ? 'bg-danger-dim/30' :
                        r.defect_rate > 0.06 ? 'bg-warning-dim/30' : '';
                      return (
                        <tr key={r.run_number} onClick={() => toggleRun(r.run_number)}
                          className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-white/[0.03] ${rowColor} ${
                            isSelected ? 'ring-1 ring-inset ring-accent/50 bg-accent-glow' : ''
                          } ${idx % 2 === 1 && !isSelected && !rowColor ? 'bg-white/[0.01]' : ''}`}>
                          <td className="px-4 py-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'border-accent bg-accent' : 'border-border'
                            }`}>
                              {isSelected && <span className="text-black text-xs font-bold">
                                {selectedRuns.indexOf(r.run_number) + 1}
                              </span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-text-primary">{r.run_number}</td>
                          <td className="px-4 py-3 text-text-secondary">{r.furnace}</td>
                          <td className="px-4 py-3 text-text-secondary">
                            {r.start_time ? new Date(r.start_time).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{r.total_pieces}</td>
                          <td className="px-4 py-3 text-right font-mono">{r.defect_count}</td>
                          <td className="px-4 py-3 text-right"><DefectRateBadge rate={r.defect_rate} /></td>
                          {department === 'bake' && (
                            <td className="px-4 py-3 text-right font-mono">{r.car_deck}</td>
                          )}
                          {department === 'graphite' && (
                            <td className="px-4 py-3 text-center">
                              {r.risk_score && <StatusBadge status={r.risk_score} />}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono text-text-secondary">
                            {r.actual_kwh?.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : compLoading ? (
        <ComparisonSkeleton />
      ) : compData ? (
        <ComparisonView data={compData} department={department} onBack={() => setComparing(false)} />
      ) : (
        <div className="text-center py-8 text-text-muted">Failed to load comparison</div>
      )}
    </div>
  );
}

function ComparisonView({ data, department, onBack }: { data: ComparisonResult; department: string; onBack: () => void }) {
  const { run_a, run_b, electrodes_a, electrodes_b, param_diff, sensors_a, sensors_b } = data;

  // Group sensors by tag
  const sensorTags = useMemo(() => {
    const tags = new Set<string>();
    sensors_a.forEach((s: SensorReading) => tags.add(s.tag_name));
    sensors_b.forEach((s: SensorReading) => tags.add(s.tag_name));
    return Array.from(tags).slice(0, 4); // show max 4
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

      {/* Side-by-side header */}
      <div className="grid grid-cols-2 gap-4">
        <RunHeader run={run_a} label="Run A" electrodes={electrodes_a} />
        <RunHeader run={run_b} label="Run B" electrodes={electrodes_b} />
      </div>

      {/* Parameter diff */}
      <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-base font-semibold text-text-secondary">Parameter Comparison</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-card border-b border-border shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            <tr className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Parameter</th>
              <th className="px-5 py-3 text-right">Run A</th>
              <th className="px-5 py-3 text-right">Run B</th>
              <th className="px-5 py-3 text-right">Deviation</th>
            </tr>
          </thead>
          <tbody>
            {param_diff.map((p: ParamDiff, idx: number) => (
              <tr key={p.parameter} className={`border-b border-border/50 hover:bg-white/[0.03] ${p.significant ? 'bg-warning-dim/20' : idx % 2 === 1 ? 'bg-white/[0.01]' : ''}`}>
                <td className="px-5 py-3 text-text-secondary">{formatParamName(p.parameter)}</td>
                <td className="px-5 py-3 text-right font-mono text-text-primary">{formatValue(p.run_a)}</td>
                <td className="px-5 py-3 text-right font-mono text-text-primary">{formatValue(p.run_b)}</td>
                <td className="px-5 py-3 text-right">
                  {p.deviation_pct !== null ? (
                    <span className={`font-mono ${
                      Math.abs(p.deviation_pct) > 50 ? 'text-red-400 font-semibold' :
                      Math.abs(p.deviation_pct) > 20 ? 'text-amber-400' :
                      'text-text-muted'
                    }`}>
                      {p.deviation_pct}%
                    </span>
                  ) : <span className="text-text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Position Maps */}
      <div className="grid grid-cols-2 gap-4">
        <PositionMap electrodes={electrodes_a} department={department} run={run_a} label="Run A" />
        <PositionMap electrodes={electrodes_b} department={department} run={run_b} label="Run B" />
      </div>

      {/* Sensor overlay */}
      {sensorTags.length > 0 && (
        <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-secondary">Sensor Data Overlay</h3>
            <div className="flex gap-1.5">
              {sensorTags.map(tag => (
                <button key={tag} onClick={() => setActiveTag(tag)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    activeTag === tag ? 'bg-accent text-black' : 'bg-bg-input text-text-muted border border-border hover:text-text-primary'
                  }`}>
                  {tag.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          {sensorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sensorChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                <XAxis dataKey="minutes" tick={{ fontSize: 12 }} label={{ value: 'Minutes from start', position: 'insideBottom', offset: -5, style: { fontSize: 12, fill: '#9ca3af' } }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTooltip formatter={(v: number) => v?.toFixed(3)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey={run_a.run_number} stroke="#f59e0b" dot={false} strokeWidth={1.5} name={`${run_a.run_number}`} />
                <Line type="monotone" dataKey={run_b.run_number} stroke="#06b6d4" dot={false} strokeWidth={1.5} name={`${run_b.run_number}`} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-text-muted text-sm">No sensor data available</div>
          )}
        </div>
      )}
    </div>
  );
}

function RunHeader({ run, label, electrodes }: { run: Run; label: string; electrodes: Electrode[] }) {
  const defective = electrodes.filter((e: Electrode) => e.defect_code_ob || e.defect_code_og || e.defect_code_of);
  return (
    <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
        <DefectRateBadge rate={run.defect_rate} />
      </div>
      <div className="font-mono text-lg text-text-primary">{run.run_number}</div>
      <div className="text-sm text-text-secondary mt-1">{run.furnace} &middot; {run.department}</div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <div>
          <div className="text-xs text-text-muted">Pieces</div>
          <div className="font-mono text-text-primary mt-0.5">{run.total_pieces}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Defects</div>
          <div className="font-mono text-danger mt-0.5">{defective.length}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">kWh</div>
          <div className="font-mono text-text-primary mt-0.5">{run.actual_kwh?.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function PositionMap({ electrodes, department, run, label }: { electrodes: Electrode[]; department: string; run: Run; label: string }) {
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
    <div className="bg-bg-card border border-border/60 rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-3">
        {label} Position Map — {run.furnace}
      </h3>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: maxPos }).map((_, i) => {
          const pos = i + 1;
          const elec = positions.find(p => p.pos === pos);
          if (!elec) {
            return <div key={pos} className="aspect-square rounded bg-bg-input border border-border/50 flex items-center justify-center text-xs text-text-muted">{pos}</div>;
          }
          return (
            <div key={pos}
              className={`aspect-square rounded border flex flex-col items-center justify-center text-xs transition-colors ${
                elec.defect
                  ? 'bg-danger-dim border-danger/40 text-danger'
                  : 'bg-success-dim border-success/30 text-success'
              }`}
              title={`Pos ${pos}: ${elec.gpn}\n${elec.defect ? `Defect: ${elec.defect_code}` : 'Clean'}\nLot: ${elec.lot}`}
            >
              <span className="font-bold">{pos}</span>
              {elec.defect && <span className="text-[10px] mt-0.5">{elec.defect_code}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-success"></span> Clean</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-danger"></span> Defect</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-bg-input border border-border"></span> Empty</span>
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart height="h-32" />
        <SkeletonChart height="h-32" />
      </div>
      <SkeletonTable rows={8} />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonChart height="h-48" />
        <SkeletonChart height="h-48" />
      </div>
    </div>
  );
}
