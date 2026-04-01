import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { DashboardOverview } from '../types';

const mockDashboardData: DashboardOverview = {
  recent_stats: {
    total_runs: 716,
    avg_defect_rate: 0.042,
    total_defects: 1520,
    total_pieces: 38400,
    total_weight: 123456,
  },
  monthly_trend: [
    { month: '2025-10-01', defect_rate: 0.045, run_count: 120, defect_count: 250 },
    { month: '2025-11-01', defect_rate: 0.038, run_count: 115, defect_count: 210 },
  ],
  furnace_status: [
    {
      furnace: 'BF-1', department: 'bake', avg_defect_rate: 0.035,
      recent_defects: 10, recent_pieces: 300, recent_runs: 5,
      trend_slope: 0.001, trend_pvalue: 0.1,
    },
  ],
  investigation_counts: { open: 5, in_progress: 3, closed: 10, verified: 7 },
  recent_anomalies: [
    {
      run_number: 'BK-00100', department: 'bake', furnace: 'BF-1',
      defect_rate: 0.12, defect_count: 5, total_pieces: 42,
      start_time: '2025-12-01T10:00:00', risk_score: null,
    },
  ],
  attention_equipment: [
    {
      furnace: 'BF-2', department: 'bake', defect_rate: 0.08,
      trend_slope: 0.003, trend_pvalue: 0.02, month: '2025-12-01',
    },
  ],
  overdue_actions: [],
};

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    getDashboard: vi.fn(),
  },
}));

import { api } from '../lib/api';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(api.getDashboard).mockResolvedValue(mockDashboardData);
  });

  it('renders KPI cards with data', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('4.2%')).toBeInTheDocument(); // defect rate
    });

    expect(screen.getByText('1,520')).toBeInTheDocument(); // total defects
    expect(screen.getByText('38,400')).toBeInTheDocument(); // electrodes produced
    expect(screen.getByText('8')).toBeInTheDocument(); // open investigations (5 + 3)
    expect(screen.getByText('1')).toBeInTheDocument(); // equipment alerts
  });

  it('renders KPI labels', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Defect Rate (90d)')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Defects')).toBeInTheDocument();
    expect(screen.getByText('Electrodes Produced')).toBeInTheDocument();
    expect(screen.getByText('Open Investigations')).toBeInTheDocument();
    expect(screen.getByText('Equipment Alerts')).toBeInTheDocument();
  });

  it('renders investigation counts by status', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Investigations')).toBeInTheDocument();
    });

    // Status badges + their counts
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders loading skeleton initially', () => {
    vi.mocked(api.getDashboard).mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('renders error state when API fails', async () => {
    vi.mocked(api.getDashboard).mockRejectedValue(new Error('API 500: Internal Server Error'));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 500: Internal Server Error')).toBeInTheDocument();
    });
  });
});
