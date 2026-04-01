import { useState, useEffect } from 'react';
import { X, RotateCcw, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useTheme } from '../App';
import type { CompositionRiskRow, RiskFactorRow } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local editable state
  const [zThreshold, setZThreshold] = useState('1.5');
  const [defectRateThreshold, setDefectRateThreshold] = useState('5');
  const [carDeckCutoff, setCarDeckCutoff] = useState('7');
  const [lotHighRisk, setLotHighRisk] = useState('5');
  const [compRisk, setCompRisk] = useState<CompositionRiskRow[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactorRow[]>([]);

  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';
  const inputBg = isDark ? '#111520' : '#ffffff';
  const inputBorder = isDark ? '#252a3a' : '#e2e5eb';

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.getSettings().then(res => {

        setZThreshold(res.settings.spc_z_threshold?.value || '1.5');
        setDefectRateThreshold(String(parseFloat(res.settings.defect_rate_anomaly_threshold?.value || '0.05') * 100));
        setCarDeckCutoff(res.settings.car_deck_high_risk_cutoff?.value || '7');
        setLotHighRisk(String(parseFloat(res.settings.lot_high_risk_defect_rate?.value || '0.05') * 100));
        setCompRisk(res.composition_risk);
        setRiskFactors(res.risk_factors);
        setLoading(false);
      });
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await api.updateSettings({
      spc_z_threshold: zThreshold,
      defect_rate_anomaly_threshold: String(parseFloat(defectRateThreshold) / 100),
      car_deck_high_risk_cutoff: carDeckCutoff,
      lot_high_risk_defect_rate: String(parseFloat(lotHighRisk) / 100),
      composition_risk: compRisk.map(r => ({
        quintile: r.quintile,
        avg_defect_rate: r.avg_defect_rate,
        probability_high_defect_event: r.probability_high_defect_event,
      })),
      risk_factors: riskFactors.map(r => ({ id: r.id, risk_group: r.risk_group })),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    setSaving(true);
    await api.resetSettings();
    const res = await api.getSettings();
    setZThreshold(res.settings.spc_z_threshold?.value || '1.5');
    setDefectRateThreshold(String(parseFloat(res.settings.defect_rate_anomaly_threshold?.value || '0.05') * 100));
    setCarDeckCutoff(res.settings.car_deck_high_risk_cutoff?.value || '7');
    setLotHighRisk(String(parseFloat(res.settings.lot_high_risk_defect_rate?.value || '0.05') * 100));
    setCompRisk(res.composition_risk);
    setRiskFactors(res.risk_factors);
    setSaving(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-screen z-50 overflow-y-auto shadow-2xl"
        style={{
          width: '480px',
          background: isDark ? '#0d1017' : '#f5f6f8',
          borderLeft: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-5 flex items-center justify-between"
          style={{
            background: isDark ? '#0d1017' : '#f5f6f8',
            borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
          }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: textPrimary }}>Quality Configuration</h2>
            <p className="text-xs mt-0.5" style={{ color: textMuted }}>Changes take effect immediately for all users</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: textMuted }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* SPC Thresholds */}
            <Section title="SPC Thresholds">
              <SettingInput label="Z-Score Threshold" value={zThreshold} onChange={setZThreshold}
                hint="Standard deviations for anomaly flagging" type="number" step="0.1" />
              <SettingInput label="Defect Rate Anomaly (%)" value={defectRateThreshold} onChange={setDefectRateThreshold}
                hint="Rate above which a run is anomalous" type="number" step="0.5" />
            </Section>

            {/* Position Risk */}
            <Section title="Position Risk">
              <SettingInput label="Car Deck High-Risk Cutoff" value={carDeckCutoff} onChange={setCarDeckCutoff}
                hint="Deck number at or above = high risk" type="number" step="1" />
              <SettingInput label="Lot High-Risk Rate (%)" value={lotHighRisk} onChange={setLotHighRisk}
                hint="Lot defect rate for high-risk tier" type="number" step="0.5" />
            </Section>

            {/* Composition Risk Quintiles */}
            <Section title="Composition Risk Quintiles">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider" style={{ color: textMuted }}>
                      <th className="px-3 py-2 text-left">Quintile</th>
                      <th className="px-3 py-2 text-right">Avg Defect Rate</th>
                      <th className="px-3 py-2 text-right">P(High Defect)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compRisk.map((row, idx) => (
                      <tr key={row.quintile} style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: textPrimary }}>{row.quintile}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" step="0.001" value={row.avg_defect_rate}
                            onChange={e => {
                              const updated = [...compRisk];
                              updated[idx] = { ...updated[idx], avg_defect_rate: parseFloat(e.target.value) || 0 };
                              setCompRisk(updated);
                            }}
                            className="w-20 text-right font-mono text-sm border rounded px-2 py-1 focus:border-amber-500 outline-none"
                            style={{ background: inputBg, borderColor: inputBorder, color: textPrimary }} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" step="0.01" value={row.probability_high_defect_event}
                            onChange={e => {
                              const updated = [...compRisk];
                              updated[idx] = { ...updated[idx], probability_high_defect_event: parseFloat(e.target.value) || 0 };
                              setCompRisk(updated);
                            }}
                            className="w-20 text-right font-mono text-sm border rounded px-2 py-1 focus:border-amber-500 outline-none"
                            style={{ background: inputBg, borderColor: inputBorder, color: textPrimary }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Risk Factor Groups */}
            <Section title="Risk Factor Groups">
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {groupByFactor(riskFactors).map(([factorName, factors]) => (
                  <div key={factorName} className="mb-3">
                    <div className="text-xs uppercase tracking-wider font-semibold mb-1.5 px-1"
                      style={{ color: textMuted }}>{factorName}</div>
                    {factors.map(f => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-1.5 rounded"
                        style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                        <span className="text-sm" style={{ color: textSecondary }}>{f.factor_level}</span>
                        <select value={f.risk_group}
                          onChange={e => {
                            setRiskFactors(prev => prev.map(rf =>
                              rf.id === f.id ? { ...rf, risk_group: e.target.value } : rf
                            ));
                          }}
                          className="text-sm border rounded px-2 py-1 focus:border-amber-500 outline-none"
                          style={{ background: inputBg, borderColor: inputBorder, color: textPrimary }}>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 pb-4">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg bg-accent text-black hover:bg-accent/90 transition-colors disabled:opacity-50">
                <Save size={16} />
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleReset} disabled={saving}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: isDark ? '#252a3a' : '#e2e5eb', color: textSecondary }}>
                <RotateCcw size={16} />
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';

  return (
    <div className="rounded-xl p-4 border" style={{
      background: isDark ? '#141824' : '#ffffff',
      borderColor: isDark ? '#252a3a' : '#e2e5eb',
    }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: textSecondary }}>{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function SettingInput({ label, value, onChange, hint, type = 'text', step }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; type?: string; step?: string;
}) {
  const { isDark } = useTheme();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';
  const inputBg = isDark ? '#111520' : '#f8f9fb';
  const inputBorder = isDark ? '#252a3a' : '#e2e5eb';

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: textPrimary }}>{label}</div>
        {hint && <div className="text-xs mt-0.5" style={{ color: textMuted }}>{hint}</div>}
      </div>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)}
        className="w-24 text-right font-mono text-sm border-2 rounded-lg px-3 py-2 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none"
        style={{ background: inputBg, borderColor: inputBorder, color: textPrimary }} />
    </div>
  );
}

function groupByFactor(factors: RiskFactorRow[]): [string, RiskFactorRow[]][] {
  const groups: Record<string, RiskFactorRow[]> = {};
  for (const f of factors) {
    if (!groups[f.factor_name]) groups[f.factor_name] = [];
    groups[f.factor_name].push(f);
  }
  return Object.entries(groups);
}
