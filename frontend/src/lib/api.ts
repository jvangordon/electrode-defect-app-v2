import type {
  DashboardOverview,
  RunsResponse,
  ComparisonResult,
  RunDetail,
  BakeAnomalyResponse,
  GraphiteRiskResponse,
  GraphiteRunRiskDetail,
  EquipmentListResponse,
  EquipmentTrendsResponse,
  EquipmentComparisonResponse,
  InvestigationsResponse,
  InvestigationDetail,
  ElectrodeDetailResponse,
  ElectrodeSearchResponse,
  AiAnalysisResponse,
  SimilarCasesResponse,
  SettingsResponse,
  KnowledgeSearchResponse,
} from '../types';

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
  getDashboard: () => request<DashboardOverview>('/dashboard/overview'),

  // Runs / Comparison
  getRuns: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<RunsResponse>(`/runs${qs}`);
  },
  compareRuns: (runA: string, runB: string) =>
    request<ComparisonResult>(`/runs/compare?run_a=${runA}&run_b=${runB}`),
  getRunDetail: (runNumber: string) => request<RunDetail>(`/runs/${runNumber}`),

  // Anomaly
  getBakeAnomalies: (limit = 50) => request<BakeAnomalyResponse>(`/anomalies/bake?limit=${limit}`),
  getGraphiteRisk: (limit = 50) => request<GraphiteRiskResponse>(`/anomalies/graphite?limit=${limit}`),
  getGraphiteRunRisk: (runNumber: string) => request<GraphiteRunRiskDetail>(`/anomalies/graphite/${runNumber}`),

  // Equipment
  getEquipment: (department?: string) => {
    const qs = department ? `?department=${department}` : '';
    return request<EquipmentListResponse>(`/equipment${qs}`);
  },
  getEquipmentTrends: (furnace: string) => request<EquipmentTrendsResponse>(`/equipment/${furnace}/trends`),
  getEquipmentComparison: (department?: string) => {
    const qs = department ? `?department=${department}` : '';
    return request<EquipmentComparisonResponse>(`/equipment/comparison${qs}`);
  },

  // Investigations
  getInvestigations: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<InvestigationsResponse>(`/investigations${qs}`);
  },
  getInvestigation: (id: number) => request<InvestigationDetail>(`/investigations/${id}`),
  createInvestigation: (data: Record<string, unknown>) =>
    request<{ investigation_id: number }>('/investigations', { method: 'POST', body: JSON.stringify(data) }),
  updateInvestigation: (id: number, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/investigations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addNote: (id: number, data: { author: string; note_text: string }) =>
    request<{ note_id: number }>(`/investigations/${id}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  addAction: (id: number, data: Record<string, unknown>) =>
    request<{ action_id: number }>(`/investigations/${id}/actions`, { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (actionId: number, data: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Electrodes
  searchElectrodes: (q: string) => request<ElectrodeSearchResponse>(`/electrodes/search?q=${q}`),
  getElectrode: (gpn: string) => request<ElectrodeDetailResponse>(`/electrodes/${gpn}`),

  // AI Analysis (Mock GenAI)
  getAiAnalysis: (investigationId: number) => request<AiAnalysisResponse>(`/investigations/${investigationId}/ai-analysis`),
  getSimilarCases: (investigationId: number) => request<SimilarCasesResponse>(`/investigations/${investigationId}/similar`),

  // Settings
  getSettings: () => request<SettingsResponse>('/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    request<{ ok: boolean }>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  resetSettings: () =>
    request<{ ok: boolean }>('/settings/reset', { method: 'POST' }),

  // Knowledge Search
  searchKnowledge: (q: string) => request<KnowledgeSearchResponse>(`/knowledge/search?q=${encodeURIComponent(q)}`),
};
