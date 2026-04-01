import { HashRouter, Routes, Route } from 'react-router-dom';
import { createContext, useContext, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RunComparison from './pages/RunComparison';
import AnomalyDetection from './pages/AnomalyDetection';
import EquipmentTrending from './pages/EquipmentTrending';
import Investigations from './pages/Investigations';
import Guide from './pages/Guide';
import SettingsPanel from './components/SettingsPanel';
import KnowledgeSearch from './components/KnowledgeSearch';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

function App() {
  const [isDark, setIsDark] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [isDark]);

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

  const toggle = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <HashRouter>
        <Sidebar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main
          className="flex-1 min-h-screen overflow-auto main-content"
          style={{ background: isDark ? '#0d1017' : '#f5f6f8' }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/comparison" element={<RunComparison />} />
            <Route path="/anomaly" element={<AnomalyDetection />} />
            <Route path="/equipment" element={<EquipmentTrending />} />
            <Route path="/investigations" element={<Investigations />} />
            <Route path="/guide" element={<Guide onOpenSettings={() => setSettingsOpen(true)} onOpenSearch={() => setSearchOpen(true)} />} />
          </Routes>
        </main>
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <KnowledgeSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </HashRouter>
    </ThemeContext.Provider>
  );
}

export default App;
