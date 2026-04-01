// ============================================================
// Core domain types
// ============================================================

export interface Run {
  run_number: string;
  department: 'bake' | 'graphite';
  furnace: string;
  profile: string;
  load_config: string | null;
  car_deck: number | null;
  total_pieces: number;
  total_weight: number;
  start_time: string;
  end_time: string;
  cooling_end_time: string | null;
  duration_hours: number;
  actual_kwh: number;
  total_downtime: number;
  defect_count: number;
  defect_rate: number;
  risk_score: string | null;
}

export interface Electrode {
  gpn: string;
  lot: string;
  mo_name: string;
  diameter: number;
  coke_blend: string;
  weight_kg: number;
  run_number_ob: string | null;
  car_deck_ob: number | null;
  load_order_ob: number | null;
  defect_code_ob: string | null;
  run_number_og: string | null;
  furnace_og: string | null;
  position_og: number | null;
  profile_og: string | null;
  defect_code_og: string | null;
  defect_code_of: string | null;
  er: number | null;
  ad: number | null;
  lot_defect_rate: number;
  risk_tier: string;
}

export interface ElectrodeSearchResult {
  gpn: string;
  lot: string;
  diameter: number;
  weight_kg: number;
  run_number_ob: string | null;
  run_number_og: string | null;
  furnace_og: string | null;
  position_og: number | null;
  defect_code_ob: string | null;
  defect_code_og: string | null;
  defect_code_of: string | null;
  risk_tier: string;
}

// ============================================================
// Dashboard
// ============================================================

export interface RecentStats {
  total_runs: number;
  avg_defect_rate: number;
  total_defects: number;
  total_pieces: number;
  total_weight: number;
}

export interface MonthlyTrend {
  month: string;
  defect_rate: number;
  run_count: number;
  defect_count: number;
}

export interface FurnaceStatus {
  furnace: string;
  department: string;
  avg_defect_rate: number;
  recent_defects: number;
  recent_pieces: number;
  recent_runs: number;
  trend_slope: number | null;
  trend_pvalue: number | null;
}

export interface RecentAnomaly {
  run_number: string;
  department: string;
  furnace: string;
  defect_rate: number;
  defect_count: number;
  total_pieces: number;
  start_time: string;
  risk_score: string | null;
}

export interface AttentionEquipment {
  furnace: string;
  department: string;
  defect_rate: number;
  trend_slope: number;
  trend_pvalue: number;
  month: string;
}

export interface OverdueAction {
  action_id: number;
  title: string;
  assigned_to: string;
  due_date: string;
  priority: string;
  status: string;
  investigation_id: number;
  defect_code: string;
  defect_site: string;
}

export interface DashboardOverview {
  recent_stats: RecentStats;
  monthly_trend: MonthlyTrend[];
  furnace_status: FurnaceStatus[];
  investigation_counts: Record<string, number>;
  recent_anomalies: RecentAnomaly[];
  attention_equipment: AttentionEquipment[];
  overdue_actions: OverdueAction[];
}

// ============================================================
// Runs / Comparison
// ============================================================

export interface RunsResponse {
  runs: Run[];
  total: number;
}

export interface ParamDiff {
  parameter: string;
  run_a: string | number | null;
  run_b: string | number | null;
  deviation_pct: number | null;
  significant: boolean;
}

export interface SensorReading {
  run_number: string;
  tag_name: string;
  timestamp: string;
  value: number;
  minutes_from_start: number;
}

export interface ComparisonResult {
  run_a: Run;
  run_b: Run;
  electrodes_a: Electrode[];
  electrodes_b: Electrode[];
  param_diff: ParamDiff[];
  sensors_a: SensorReading[];
  sensors_b: SensorReading[];
}

export interface RunDetail {
  run: Run;
  electrodes: Electrode[];
  sensors: SensorReading[];
}

// ============================================================
// Anomaly Detection
// ============================================================

export interface Deviation {
  parameter: string;
  value: number;
  mean: number;
  z_score: number;
  direction: 'high' | 'low';
}

export interface BakeAnomaly extends Run {
  deviations: Deviation[];
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  is_anomaly: boolean;
}

export interface PopulationStats {
  mean_deck: number | null;
  std_deck: number | null;
  mean_duration: number | null;
  std_duration: number | null;
  mean_kwh: number | null;
  mean_downtime: number | null;
  mean_defect_rate: number | null;
}

export interface SpcDataPoint {
  run_number: string;
  furnace: string;
  car_deck: number;
  defect_rate: number;
  start_time: string;
}

export interface BakeAnomalyResponse {
  anomalies: BakeAnomaly[];
  population_stats: PopulationStats;
  spc_data: SpcDataPoint[];
}

export interface CompositionElectrode {
  gpn: string;
  lot: string;
  position_og: number | null;
  diameter: number;
  coke_blend: string;
  defect_code_og: string | null;
  defect_code_of: string | null;
  lot_defect_rate: number | null;
  risk_tier: string | null;
}

export interface Composition {
  electrodes: CompositionElectrode[];
  high_risk_lot_count: number;
  edge_position_count: number;
  avg_lot_defect_rate: number;
  total_electrodes: number;
}

export interface GraphiteAssessment extends Run {
  composition: Composition;
}

export interface Quintile {
  quintile: string;
  avg_defect_rate: number;
  probability_high_defect_event: number;
}

export interface GraphiteRiskResponse {
  assessments: GraphiteAssessment[];
  quintiles: Quintile[];
}

export interface RiskFactor {
  factor_name: string;
  factor_level: string;
  risk_group: string;
}

export interface CompoundingRate {
  n_factors: number;
  avg_defect_rate: number;
  probability_high_defect_event: number;
}

export interface GraphiteRunRiskDetail {
  run: Run;
  electrodes: Electrode[];
  risk_factors: RiskFactor[];
  compounding_rates: CompoundingRate[];
}

// ============================================================
// Equipment
// ============================================================

export interface EquipmentItem {
  furnace: string;
  department: string;
  defect_rate: number;
  avg_kwh: number;
  avg_run_time: number;
  avg_downtime: number;
  avg_car_deck: number | null;
  run_count: number;
  month: string;
  trend_slope: number;
  trend_pvalue: number;
  trend_direction: 'degrading' | 'improving' | 'stable';
}

export interface EquipmentListResponse {
  equipment: EquipmentItem[];
}

export interface MonthlyEquipmentData {
  month: string;
  department: string;
  defect_rate: number;
  avg_kwh: number;
  avg_run_time: number;
  avg_downtime: number;
  avg_car_deck: number | null;
  run_count: number;
  trend_slope: number;
  trend_pvalue: number;
}

export interface TrendPoint {
  month: string;
  value: number;
}

export interface EquipmentTrendsResponse {
  furnace: string;
  department: string;
  monthly: MonthlyEquipmentData[];
  trend_line: TrendPoint[];
  slope: number;
  r_squared: number;
  recent_runs: Run[];
}

export interface EquipmentComparisonItem {
  furnace: string;
  department: string;
  defect_rate: number;
  avg_kwh: number;
  avg_run_time: number;
  avg_downtime: number;
  run_count: number;
  trend_slope: number;
  trend_pvalue: number;
}

export interface EquipmentMonthly {
  furnace: string;
  month: string;
  defect_rate: number;
}

export interface EquipmentComparisonResponse {
  current: EquipmentComparisonItem[];
  monthly: EquipmentMonthly[];
}

// ============================================================
// Investigations
// ============================================================

export interface Investigation {
  investigation_id: number;
  gpn: string;
  run_number: string | null;
  defect_code: string | null;
  defect_site: string | null;
  root_cause_category: string | null;
  root_cause_detail: string | null;
  corrective_action: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string | null;
  status: string;
  closed_at: string | null;
  effectiveness_notes: string | null;
  created_at: string;
  note_count?: number;
  action_count?: number;
  overdue_actions?: number;
}

export interface InvestigationsResponse {
  investigations: Investigation[];
  total: number;
}

export interface Note {
  note_id: number;
  investigation_id: number;
  author: string;
  note_text: string;
  created_at: string;
}

export interface CorrectiveAction {
  action_id: number;
  investigation_id: number;
  title: string;
  description: string | null;
  action_type: string;
  assigned_to: string | null;
  priority: string;
  due_date: string | null;
  expected_savings: number | null;
  actual_savings: number | null;
  status: string;
  completed_at: string | null;
  verified_at: string | null;
  verification_notes: string | null;
}

export interface InvestigationDetail {
  investigation: Investigation;
  notes: Note[];
  actions: CorrectiveAction[];
}

// ============================================================
// Electrode Detail
// ============================================================

export interface LifecycleStep {
  step_name: string;
  status: 'clean' | 'defect' | 'no_data';
  defect_code: string | null;
  run_number: string | null;
  furnace: string | null;
  parameters: {
    kwh?: number | null;
    duration?: number | null;
    furnace?: string | null;
  };
}

export interface Sibling {
  gpn: string;
  lot: string;
  position_og: number | null;
  diameter: number;
  defect_code_og: string | null;
  defect_code_of: string | null;
  weight_kg: number;
  er: number | null;
  ad: number | null;
}

export interface ElectrodeDetailResponse {
  electrode: Electrode;
  bake_run: Run | null;
  graphite_run: Run | null;
  siblings: Sibling[];
  risk_factors: RiskFactor[];
  lifecycle: LifecycleStep[];
  investigations: Investigation[];
}

// ============================================================
// AI Analysis (Mock GenAI Feature A)
// ============================================================

export interface AiAnalysisFactor {
  name: string;
  impact: 'high' | 'medium' | 'low';
  detail: string;
}

export interface AiAnalysisResponse {
  analysis: string;
  confidence: number;
  factors: AiAnalysisFactor[];
  recommendation: string;
}

// ============================================================
// Similar Cases (Mock GenAI Feature B)
// ============================================================

export interface SimilarCase {
  investigation: Investigation;
  match_score: number;
  match_explanation: string;
  effective_action: string | null;
}

export interface SimilarCasesResponse {
  similar_cases: SimilarCase[];
}

// ============================================================
// Search
// ============================================================

export interface ElectrodeSearchResponse {
  results: ElectrodeSearchResult[];
}
