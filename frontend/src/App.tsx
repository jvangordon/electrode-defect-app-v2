import { HashRouter, Routes, Route } from 'react-router-dom';
import { createContext, useContext, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RunComparison from './pages/RunComparison';
import AnomalyDetection from './pages/AnomalyDetection';
import EquipmentTrending from './pages/EquipmentTrending';
import Investigations from './pages/Investigations';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

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
        <Sidebar />
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
          </Routes>
        </main>
      </HashRouter>
    </ThemeContext.Provider>
  );
}

export default App;
