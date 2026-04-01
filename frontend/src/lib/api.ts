const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => request<any>('/dashboard/overview'),

  // Runs / Comparison
  getRuns: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/runs${qs}`);
  },
  compareRuns: (runA: string, runB: string) =>
    request<any>(`/runs/compare?run_a=${runA}&run_b=${runB}`),
  getRunDetail: (runNumber: string) => request<any>(`/runs/${runNumber}`),

  // Anomaly
  getBakeAnomalies: (limit = 50) => request<any>(`/anomalies/bake?limit=${limit}`),
  getGraphiteRisk: (limit = 50) => request<any>(`/anomalies/graphite?limit=${limit}`),
  getGraphiteRunRisk: (runNumber: string) => request<any>(`/anomalies/graphite/${runNumber}`),

  // Equipment
  getEquipment: (department?: string) => {
    const qs = department ? `?department=${department}` : '';
    return request<any>(`/equipment${qs}`);
  },
  getEquipmentTrends: (furnace: string) => request<any>(`/equipment/${furnace}/trends`),
  getEquipmentComparison: (department?: string) => {
    const qs = department ? `?department=${department}` : '';
    return request<any>(`/equipment/comparison${qs}`);
  },

  // Investigations
  getInvestigations: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/investigations${qs}`);
  },
  getInvestigation: (id: number) => request<any>(`/investigations/${id}`),
  createInvestigation: (data: any) =>
    request<any>('/investigations', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestigation: (id: number, data: any) =>
    request<any>(`/investigations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addNote: (id: number, data: any) =>
    request<any>(`/investigations/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  addAction: (id: number, data: any) =>
    request<any>(`/investigations/${id}/actions`, { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (actionId: number, data: any) =>
    request<any>(`/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Electrodes
  searchElectrodes: (q: string) => request<any>(`/electrodes/search?q=${q}`),
  getElectrode: (gpn: string) => request<any>(`/electrodes/${gpn}`),
};
