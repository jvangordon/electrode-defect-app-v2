import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitCompareArrows, AlertTriangle, TrendingUp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Operations' },
  { to: '/comparison', icon: GitCompareArrows, label: 'Run Comparison' },
  { to: '/anomaly', icon: AlertTriangle, label: 'Anomaly Detection' },
  { to: '/equipment', icon: TrendingUp, label: 'Equipment Trending' },
  { to: '/investigations', icon: Search, label: 'Investigations' },
];

function EdrsLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Electrode cross-section: concentric circles with a furnace-like mark */}
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.15" />
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="1.5" />
      {/* Heat lines radiating outward */}
      <line x1="16" y1="2" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="27" x2="16" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="16" x2="5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Inner dot — the graphite core */}
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[220px]'
      }`}
      style={{ background: '#0a0c10', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Logo area */}
      <div className={`flex items-center gap-3 px-4 h-16 mb-6 border-b border-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="text-accent flex-shrink-0">
          <EdrsLogo size={collapsed ? 24 : 28} />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-semibold text-text-primary tracking-wider">EDRS</div>
            <div className="text-xs text-text-muted tracking-widest uppercase">Electrode Defect</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-glow text-accent border-l-[3px] border-l-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-[#141722]'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} strokeWidth={1.8} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border">
        {!collapsed && (
          <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2 h-2 rounded-full bg-[#FF3621]"></span>
            <span>Powered by Databricks</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-10 text-text-muted hover:text-text-primary transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
