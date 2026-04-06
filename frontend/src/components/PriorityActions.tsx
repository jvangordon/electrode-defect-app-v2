import { useEffect, useState } from 'react';
import { useTheme } from '../App';
import { ArrowRight, AlertTriangle, TrendingUp, Search, DollarSign } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  headline: string;
  detail: string;
  action_label: string;
  action_path: string;
}

const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
  'Pre-Load Risk': AlertTriangle,
  'Investigation': Search,
  'Equipment Watch': TrendingUp,
  'Cost Alert': DollarSign,
};

export default function PriorityActions() {
  const { isDark } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch('/api/alerts/active')
      .then(r => r.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch('/api/alerts/active')
        .then(r => r.json())
        .then(data => setAlerts(data.alerts || []))
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  const accentColor = (s: string) =>
    s === 'critical' ? '#ef4444' : s === 'high' ? '#f59e0b' : '#3b82f6';

  const bgGradient = (s: string) =>
    s === 'critical'
      ? isDark ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)'
               : 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.01) 100%)'
      : s === 'high'
      ? isDark ? 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)'
               : 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.01) 100%)'
      : isDark ? 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)'
               : 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.01) 100%)';

  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: textSecondary }}>
        What Needs Your Attention
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alerts.slice(0, 4).map(alert => {
          const Icon = CATEGORY_ICONS[alert.category] || AlertTriangle;
          const color = accentColor(alert.severity);

          return (
            <div
              key={alert.id}
              className="rounded-xl border p-5 transition-all hover:shadow-lg cursor-pointer group"
              style={{
                borderColor: `${color}25`,
                background: bgGradient(alert.severity),
              }}
              onClick={() => { window.location.hash = alert.action_path; }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold leading-snug" style={{ color: textPrimary }}>
                    {alert.headline}
                  </div>
                  <div className="text-sm mt-1.5 leading-relaxed" style={{ color: textSecondary }}>
                    {alert.detail}
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium group-hover:gap-2.5 transition-all"
                    style={{ color }}
                  >
                    {alert.action_label}
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
