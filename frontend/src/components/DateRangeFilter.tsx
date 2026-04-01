import { useState } from 'react';
import { useTheme } from '../App';

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

interface Preset {
  label: string;
  days: number | null;
}

const PRESETS: Preset[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 183 },
  { label: '1yr', days: 365 },
  { label: 'All', days: null },
];

function computeRange(days: number | null): DateRange {
  if (days === null) return { startDate: null, endDate: null };
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function DateRangeFilter({
  defaultPreset = '90d',
  onChange,
}: {
  defaultPreset?: string;
  onChange: (range: DateRange) => void;
}) {
  const [active, setActive] = useState(defaultPreset);
  const { isDark } = useTheme();

  const handlePreset = (preset: Preset) => {
    setActive(preset.label);
    onChange(computeRange(preset.days));
  };

  return (
    <div className="flex items-center gap-1">
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => handlePreset(p)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            active === p.label
              ? 'bg-accent text-black'
              : isDark
              ? 'text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#1a1f2e]'
              : 'text-[#4b5068] hover:text-[#1a1d2b] hover:bg-[#eef0f4]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function getInitialRange(defaultPreset: string = '90d'): DateRange {
  const preset = PRESETS.find(p => p.label === defaultPreset);
  return computeRange(preset?.days ?? 90);
}
