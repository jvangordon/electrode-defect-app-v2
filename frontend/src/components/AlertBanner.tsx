import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../App';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  headline: string;
  detail: string;
  action_label: string;
  action_path: string;
}

export default function AlertBanner() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAlerts = () => {
      fetch('/api/alerts/active')
        .then(r => r.json())
        .then(data => setAlerts(data.alerts || []))
        .catch(() => {});
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const hasCritical = visible.some(a => a.severity === 'critical');

  const borderColor = (s: string) =>
    s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : '#3b82f6';

  const bgColor = (s: string) =>
    s === 'critical'
      ? isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)'
      : s === 'high'
      ? isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'
      : isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)';

  return (
    <div
      className="mx-10 mt-6 mb-0 rounded-xl border px-5 py-4"
      style={{
        borderColor: hasCritical
          ? isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'
          : isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)',
        background: hasCritical
          ? isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)'
          : isDark ? 'rgba(245,158,11,0.04)' : 'rgba(245,158,11,0.03)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={15} className={hasCritical ? 'text-red-400' : 'text-amber-400'} />
        <span className={`text-sm font-semibold ${hasCritical ? 'text-red-400' : 'text-amber-400'}`}>
          {visible.length} Active Alert{visible.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {visible.slice(0, 5).map(alert => (
          <div
            key={alert.id}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
            style={{
              borderLeft: `3px solid ${borderColor(alert.severity)}`,
              background: bgColor(alert.severity),
            }}
          >
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
              style={{ color: borderColor(alert.severity), border: `1px solid ${borderColor(alert.severity)}30` }}
            >
              {alert.category}
            </span>
            <span className="text-sm flex-1" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
              {alert.headline}
            </span>
            <button
              onClick={() => navigate(alert.action_path)}
              className="text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap hover:opacity-80"
              style={{ color: borderColor(alert.severity), borderColor: `${borderColor(alert.severity)}50` }}
            >
              {alert.action_label}
            </button>
            <button
              onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
              className="transition-colors hover:opacity-80"
              style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
