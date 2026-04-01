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

function EdrsLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.15" />
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="2" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="27" x2="16" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="16" x2="5" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
      style={{ background: '#0a0c10', borderRight: '1px solid #1e2130' }}
    >
      {/* Logo area */}
      <div className={`flex items-center gap-3 px-5 py-6 mb-4 ${collapsed ? 'justify-center px-3' : ''}`}>
        <div className="text-accent flex-shrink-0">
          <EdrsLogo size={collapsed ? 28 : 34} />
        </div>
        {!collapsed && (
          <div>
            <div className="text-base font-bold text-text-primary tracking-wide">EDRS</div>
            <div className="text-xs text-text-muted tracking-widest uppercase mt-0.5">Electrode Defect</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3.5 rounded-lg text-[15px] font-medium transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border-l-[3px] border-l-amber-500 shadow-sm'
                  : 'text-[#8b8fa3] hover:text-text-primary hover:bg-[#141722]'
              } ${collapsed ? 'justify-center px-3' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} strokeWidth={1.8} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-[#1e2130]">
        {!collapsed && (
          <div className="px-5 py-4 flex items-center gap-2 text-xs text-text-muted/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF3621]"></span>
            <span>Powered by Databricks</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-12 text-text-muted hover:text-text-primary transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
