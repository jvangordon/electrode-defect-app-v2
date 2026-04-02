import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../App';
import { api } from '../lib/api';
import { formatCost } from '../lib/format';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const TAG_LABELS: Record<string, string> = {
  push_displacement_avg: 'Push Displacement (Avg)',
  push_displacement_left: 'Push Displacement (Left)',
  push_displacement_right: 'Push Displacement (Right)',
  push_displacement_roc: 'Push Displacement Rate of Change',
  push_roc_mm_min: 'Push ROC (mm/min)',
  resistance_rate: 'Resistance Rate',
  downtime_minutes: 'Downtime (minutes)',
};

const TAG_ORDER = [
  'push_displacement_avg',
  'push_displacement_left',
  'push_displacement_right',
  'push_displacement_roc',
  'push_roc_mm_min',
  'resistance_rate',
  'downtime_minutes',
];

interface ActiveRun {
  run_number: string;
  furnace: string;
  total_pieces: number;
  profile: string;
  car_deck: number | null;
  duration_hours: number;
  defect_cost: number;
  simulated_start: string;
  risk_score: string;
  risk_quintile: string;
  status: string;
}

interface Reading {
  tag_name: string;
  timestamp: string;
  value: number;
  minutes_from_start: number;
}

interface Threshold {
  mean: number;
  upper: number;
  lower: number;
}

interface Alert {
  tag_name: string;
  value: number;
  threshold: number;
  direction: string;
  minutes_from_start: number;
  timestamp: string;
}

interface LiveData {
  run_number: string;
  elapsed_minutes: number;
  total_duration_minutes: number;
  is_complete: boolean;
  readings: Reading[];
  thresholds: Record<string, Threshold>;
  alerts: Alert[];
}

function CustomDot(props: any) {
  const { cx, cy, payload, thresholds, tagName } = props;
  if (cx == null || cy == null) return null;
  const thresh = thresholds?.[tagName];
  const isBreaching = thresh && (payload.value > thresh.upper || payload.value < thresh.lower);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isBreaching ? 5 : 3}
      fill={isBreaching ? '#ef4444' : '#06b6d4'}
      stroke="none"
      style={{ filter: isBreaching ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.7))' : undefined }}
    />
  );
}

export default function LiveMonitor() {
  useTheme();
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(30);
  const [isComplete, setIsComplete] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const seenAlertsRef = useRef<Set<string>>(new Set());

  // Fetch active run on mount
  useEffect(() => {
    api.getActiveRun().then((data: any) => {
      if (data && data.run_number) {
        setActiveRun(data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Poll: increment elapsed every 2 seconds by 90 minutes
  useEffect(() => {
    if (isComplete || !activeRun) return;
    const interval = setInterval(() => {
      setElapsedMinutes(prev => prev + 90);
    }, 2000);
    return () => clearInterval(interval);
  }, [isComplete, activeRun]);

  // Fetch live data when elapsed changes
  const fetchLiveData = useCallback(() => {
    if (!activeRun) return;
    api.getLiveData(activeRun.run_number, elapsedMinutes).then((data: LiveData) => {
      setLiveData(data);
      if (data.is_complete) setIsComplete(true);

      // Track new alerts
      if (data.alerts && data.alerts.length > 0) {
        const newAlerts: Alert[] = [];
        for (const alert of data.alerts) {
          const key = `${alert.tag_name}-${alert.minutes_from_start}`;
          if (!seenAlertsRef.current.has(key)) {
            seenAlertsRef.current.add(key);
            newAlerts.push(alert);
          }
        }
        if (newAlerts.length > 0) {
          setAllAlerts(prev => [...prev, ...newAlerts]);
        }
      }
    }).catch(() => {});
  }, [activeRun, elapsedMinutes]);

  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(180deg, #0d1017 0%, #0f1420 100%)' }}>
        <div className="text-gray-500 text-lg">Loading live monitor...</div>
      </div>
    );
  }

  if (!activeRun) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(180deg, #0d1017 0%, #0f1420 100%)' }}>
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-4">No active run found</div>
          <Link to="/" className="text-emerald-400 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Group readings by tag
  const readingsByTag: Record<string, { hours: number; value: number }[]> = {};
  if (liveData) {
    for (const r of liveData.readings) {
      if (!readingsByTag[r.tag_name]) readingsByTag[r.tag_name] = [];
      readingsByTag[r.tag_name].push({
        hours: Math.round(r.minutes_from_start / 60 * 10) / 10,
        value: r.value,
      });
    }
  }

  const totalDurationHours = activeRun.duration_hours;
  const elapsedHours = Math.round(elapsedMinutes / 60 * 10) / 10;
  const nowHours = Math.min(elapsedHours, totalDurationHours);
  const totalAlertCount = allAlerts.length;
  const uniqueTagsWithAlerts = new Set(allAlerts.map(a => a.tag_name)).size;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0d1017 0%, #0f1420 100%)' }}>
      <div className="flex">
        {/* Main content */}
        <div className="flex-1 p-8 overflow-auto" style={{ maxWidth: 'calc(100% - 350px)' }}>
          {/* Header bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-500 hover:text-gray-300 transition-colors">
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle size={16} className="text-gray-500" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-emerald-400" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                )}
                <h1 className="text-xl font-bold text-white font-mono">
                  {activeRun.furnace} · Run {activeRun.run_number} · {isComplete ? 'Complete' : 'Live Monitoring'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                Elapsed: <span className="font-mono text-white">{elapsedHours.toFixed(1)}h</span> / {totalDurationHours.toFixed(1)}h
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: activeRun.risk_quintile === 'Q5' ? 'rgba(239,68,68,0.15)' :
                    activeRun.risk_quintile === 'Q4' ? 'rgba(245,158,11,0.15)' :
                    activeRun.risk_quintile === 'Q3' ? 'rgba(245,158,11,0.1)' :
                    'rgba(16,185,129,0.1)',
                  color: activeRun.risk_quintile === 'Q5' ? '#ef4444' :
                    activeRun.risk_quintile === 'Q4' ? '#f59e0b' :
                    activeRun.risk_quintile === 'Q3' ? '#f59e0b' :
                    '#10b981',
                }}
              >
                Risk {activeRun.risk_quintile}
              </div>
            </div>
          </div>

          {/* Completion banner */}
          {isComplete && (
            <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: 'rgba(107, 114, 128, 0.1)', border: '1px solid rgba(107, 114, 128, 0.2)' }}>
              <CheckCircle size={20} className="text-gray-400" />
              <div>
                <span className="text-white font-semibold">Run Complete</span>
                <span className="text-gray-400 ml-2">
                  Final Status: {totalAlertCount} threshold violations across {uniqueTagsWithAlerts} sensors detected
                </span>
              </div>
            </div>
          )}

          {/* Sensor charts */}
          <div className="space-y-4">
            {TAG_ORDER.map(tag => {
              const data = readingsByTag[tag] || [];
              const thresh = liveData?.thresholds?.[tag];

              return (
                <div key={tag} className="rounded-xl p-4" style={{ background: 'rgba(20, 24, 36, 0.8)', border: '1px solid rgba(37, 42, 58, 0.6)' }}>
                  <div className="text-sm font-medium text-gray-400 mb-2">{TAG_LABELS[tag] || tag}</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,42,58,0.5)" />
                      <XAxis
                        dataKey="hours"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(v: number) => `${v}h`}
                        domain={[0, totalDurationHours]}
                        type="number"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={60} />
                      <Tooltip
                        contentStyle={{ background: '#1a1f2e', border: '1px solid #252a3a', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(v: any) => `${v}h elapsed`}
                        formatter={(v: any) => [Number(v).toFixed(3), TAG_LABELS[tag] || tag]}
                      />
                      {/* Mean reference line */}
                      {thresh && (
                        <ReferenceLine y={thresh.mean} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} />
                      )}
                      {/* Upper threshold */}
                      {thresh && (
                        <ReferenceLine y={thresh.upper} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1} label={{ value: 'Upper', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                      )}
                      {/* Lower threshold */}
                      {thresh && (
                        <ReferenceLine y={thresh.lower} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1} label={{ value: 'Lower', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                      )}
                      {/* Now marker */}
                      {!isComplete && (
                        <ReferenceLine x={nowHours} stroke="#ffffff" strokeDasharray="4 4" strokeWidth={1.5} />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={<CustomDot thresholds={liveData?.thresholds} tagName={tag} />}
                        isAnimationActive={false}
                        style={{ filter: 'drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          {/* Run context card */}
          <div className="rounded-xl p-5 mt-6" style={{ background: 'rgba(20, 24, 36, 0.8)', border: '1px solid rgba(37, 42, 58, 0.6)' }}>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Run Context</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ContextItem label="Furnace" value={activeRun.furnace} />
              <ContextItem label="Profile" value={activeRun.profile} />
              <ContextItem label="Electrodes" value={String(activeRun.total_pieces)} />
              <ContextItem label="Risk Quintile" value={activeRun.risk_quintile} />
              <ContextItem label="Duration" value={`${activeRun.duration_hours.toFixed(1)}h`} />
              <ContextItem label="Defect Cost" value={formatCost(activeRun.defect_cost)} highlight />
            </div>
          </div>
        </div>

        {/* Alert sidebar */}
        <div className="w-[350px] border-l p-4 overflow-y-auto" style={{ borderColor: 'rgba(37, 42, 58, 0.6)', maxHeight: '100vh' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-300">Alerts ({allAlerts.length})</h2>
          </div>

          {allAlerts.length === 0 && (
            <div className="text-sm text-gray-600 text-center py-8">No threshold violations yet</div>
          )}

          <div className="space-y-3">
            {[...allAlerts].reverse().map((alert, i) => (
              <div
                key={`${alert.tag_name}-${alert.minutes_from_start}-${i}`}
                className="rounded-lg p-3 alert-card-enter"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <div className="text-xs font-semibold text-red-400 mb-1">{TAG_LABELS[alert.tag_name] || alert.tag_name}</div>
                <div className="text-xs text-gray-400">
                  Value: <span className="text-white font-mono">{alert.value.toFixed(3)}</span>
                  {' '}{alert.direction === 'above' ? '>' : '<'}{' '}
                  threshold <span className="text-amber-400 font-mono">{alert.threshold.toFixed(3)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  at {(alert.minutes_from_start / 60).toFixed(1)}h elapsed
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    Flag for Inspection
                  </button>
                  <Link
                    to={`/investigations?run=${activeRun.run_number}&tag=${alert.tag_name}`}
                    className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    Create Investigation
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .alert-card-enter {
          animation: slideIn 300ms ease-out both;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function ContextItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono mt-1 ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
