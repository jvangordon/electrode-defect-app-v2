import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { createContext, useContext, useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RunComparison from './pages/RunComparison';
import AnomalyDetection from './pages/AnomalyDetection';
import EquipmentTrending from './pages/EquipmentTrending';
import Investigations from './pages/Investigations';
import GeniePage from './pages/GeniePage';
import Guide from './pages/Guide';
import SettingsPanel from './components/SettingsPanel';
import KnowledgeSearch from './components/KnowledgeSearch';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

/** Inner shell — has access to useLocation from HashRouter */
function AppShell() {
  const location = useLocation();
  const { isDark } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isGeniePage = location.pathname === '/genie';

  // Global ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Sidebar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Regular routed pages */}
      <main
        className="flex-1 min-h-screen overflow-auto main-content"
        style={{
          background: isDark ? '#0d1017' : '#f5f6f8',
          display: isGeniePage ? 'none' : undefined,
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/comparison" element={<RunComparison />} />
          <Route path="/anomaly" element={<AnomalyDetection />} />
          <Route path="/equipment" element={<EquipmentTrending />} />
          <Route path="/investigations" element={<Investigations />} />
          <Route path="/guide" element={<Guide onOpenSettings={() => setSettingsOpen(true)} onOpenSearch={() => setSearchOpen(true)} />} />
          {/* /genie handled by persistent shell below */}
          <Route path="/genie" element={null} />
        </Routes>
      </main>

      {/* Persistent Genie iframe — rendered once, visibility toggled.
          Uses h-screen + flex-col so the iframe fills remaining vertical space. */}
      <div
        className="flex-1 h-screen overflow-hidden main-content"
        style={{
          background: isDark ? '#0d1017' : '#f5f6f8',
          display: isGeniePage ? 'flex' : 'none',
          flexDirection: 'column',
        }}
      >
        <GeniePage />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <KnowledgeSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function App() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <HashRouter>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </HashRouter>
    </ThemeContext.Provider>
  );
}

export default App;
