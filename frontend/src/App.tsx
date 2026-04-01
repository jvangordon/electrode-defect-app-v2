import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import RunComparison from './pages/RunComparison';
import AnomalyDetection from './pages/AnomalyDetection';
import EquipmentTrending from './pages/EquipmentTrending';
import Investigations from './pages/Investigations';

function App() {
  return (
    <HashRouter>
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-auto" style={{ background: 'var(--color-bg-secondary)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/comparison" element={<RunComparison />} />
          <Route path="/anomaly" element={<AnomalyDetection />} />
          <Route path="/equipment" element={<EquipmentTrending />} />
          <Route path="/investigations" element={<Investigations />} />
        </Routes>
      </main>
    </HashRouter>
  );
}

export default App;
