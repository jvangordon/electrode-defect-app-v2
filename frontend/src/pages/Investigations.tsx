import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonCard } from '../components/LoadingSkeleton';
import StatusBadge from '../components/StatusBadge';
import { useTheme } from '../App';
import { Search, MessageSquare, CheckCircle2, Clock, ChevronRight, Sparkles, DollarSign } from 'lucide-react';
import { formatCost, formatCostFull } from '../lib/format';
import type {
  InvestigationsResponse, Investigation,
  Note, CorrectiveAction, LifecycleStep,
  Sibling, RiskFactor, ElectrodeSearchResult,
  AiAnalysisResponse, AiAnalysisFactor, SimilarCase,
  Recommendation,
} from '../types';

type View = 'list' | 'detail' | 'electrode';

function useCardClass() {
  const { isDark } = useTheme();
  return isDark
    ? 'bg-[#141824] border border-[#252a3a] rounded-xl'
    : 'bg-white border border-[#e2e5eb] rounded-xl shadow-sm';
}

export default function Investigations() {
  const [view, setView] = useState<View>('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvId, setSelectedInvId] = useState<number | null>(null);
  const [selectedGpn, setSelectedGpn] = useState<string | null>(null);
  const { isDark } = useTheme();

  const { data: invData, loading: invLoading, refetch: refetchInv } = useApi(
    () => api.getInvestigations(statusFilter ? { status: statusFilter } : {}),
    [statusFilter],
  );

  const { data: searchResults } = useApi(
    () => searchQuery.length >= 2 ? api.searchElectrodes(searchQuery) : Promise.resolve({ results: [] }),
    [searchQuery],
  );

  const openInvestigation = (id: number) => { setSelectedInvId(id); setView('detail'); };
  const openElectrode = (gpn: string) => { setSelectedGpn(gpn); setView('electrode'); };

  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';

  return (
    <div className="p-10 max-w-[1600px] mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: textPrimary }}>Investigation Workflow</h1>
        {view !== 'list' && (
          <button onClick={() => setView('list')}
            className="text-sm text-accent hover:underline font-medium">← Back to list</button>
        )}
      </div>

      {view === 'list' && (
        <InvestigationList
          invData={invData}
          invLoading={invLoading}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults?.results || []}
          onOpenInvestigation={openInvestigation}
          onOpenElectrode={openElectrode}
        />
      )}
      {view === 'detail' && selectedInvId && (
        <InvestigationDetail id={selectedInvId} onOpenElectrode={openElectrode} refetchList={refetchInv} />
      )}
      {view === 'electrode' && selectedGpn && (
        <ElectrodeDetail gpn={selectedGpn} onOpenInvestigation={openInvestigation} />
      )}
    </div>
  );
}

function InvestigationList({ invData, invLoading, statusFilter, setStatusFilter, searchQuery, setSearchQuery, searchResults, onOpenInvestigation, onOpenElectrode }: {
  invData: InvestigationsResponse | null;
  invLoading: boolean;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  searchResults: ElectrodeSearchResult[];
  onOpenInvestigation: (id: number) => void;
  onOpenElectrode: (gpn: string) => void;
}) {
  const investigations = invData?.investigations || [];
  const { isDark } = useTheme();
  const card = useCardClass();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <>
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by GPN, lot, or run number..."
            className="w-full border-2 rounded-lg pl-10 pr-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
            style={{
              background: isDark ? '#111520' : '#ffffff',
              borderColor: isDark ? '#252a3a' : '#e2e5eb',
              color: textPrimary,
            }} />
        </div>
        <div className="flex gap-1.5">
          {['', 'open', 'in_progress', 'closed', 'verified'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === s ? 'bg-accent text-black font-semibold' :
                isDark ? 'bg-[#141824] text-[#9ca3af] border border-[#252a3a] hover:text-[#e5e7eb]'
                : 'bg-white text-[#4b5068] border border-[#e2e5eb] hover:text-[#1a1d2b]'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && searchResults.length > 0 && (
        <div className={`${card} p-4`}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: textMuted }}>Search Results ({searchResults.length})</h3>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {searchResults.map((e: ElectrodeSearchResult) => (
              <div key={e.gpn} onClick={() => onOpenElectrode(e.gpn)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-bg-card-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px]" style={{ color: textPrimary }}>{e.gpn}</span>
                  <span className="text-[13px]" style={{ color: textMuted }}>{e.lot}</span>
                  <span className="text-[13px]" style={{ color: textMuted }}>{e.furnace_og}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(e.defect_code_ob || e.defect_code_og || e.defect_code_of) ? (
                    <StatusBadge status="defect" />
                  ) : (
                    <StatusBadge status="clean" />
                  )}
                  <ChevronRight size={14} style={{ color: textMuted }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation table */}
      <div className={`${card} overflow-hidden`}>
        {invLoading ? <div className="p-6"><SkeletonTable rows={8} /></div> : (
          <div className="max-h-[540px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 shadow-sm" style={{
                background: isDark ? '#0f1320' : '#f8f9fb',
                borderBottom: `2px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
              }}>
                <tr className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                  <th className="px-5 py-4 text-left">ID</th>
                  <th className="px-5 py-4 text-left">GPN</th>
                  <th className="px-5 py-4 text-left">Defect</th>
                  <th className="px-5 py-4 text-left">Site</th>
                  <th className="px-5 py-4 text-left">Root Cause</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-left">Assigned</th>
                  <th className="px-5 py-4 text-left">Due</th>
                  <th className="px-5 py-4 text-right">Notes</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv: Investigation, idx: number) => {
                  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !['closed', 'verified'].includes(inv.status);
                  return (
                    <tr key={inv.investigation_id} onClick={() => onOpenInvestigation(inv.investigation_id)}
                      className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${
                        isOverdue ? 'bg-danger-dim/20' : idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                      }`}
                      style={{ borderBottom: `1px solid ${isDark ? '#252a3a50' : '#e2e5eb'}` }}>
                      <td className="px-5 py-4 font-mono" style={{ color: textPrimary }}>#{inv.investigation_id}</td>
                      <td className="px-5 py-4 font-mono text-accent">{inv.gpn?.slice(0, 14)}</td>
                      <td className="px-5 py-4" style={{ color: textSecondary }}>{inv.defect_code}</td>
                      <td className="px-5 py-4" style={{ color: textSecondary }}>{inv.defect_site}</td>
                      <td className="px-5 py-4" style={{ color: textSecondary }}>{inv.root_cause_category}</td>
                      <td className="px-5 py-4 text-center"><StatusBadge status={inv.status} /></td>
                      <td className="px-5 py-4" style={{ color: textSecondary }}>{inv.assigned_to}</td>
                      <td className="px-5 py-4">
                        <span className={`text-sm ${isOverdue ? 'text-danger font-medium' : ''}`}
                          style={{ color: isOverdue ? undefined : textMuted }}>
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono" style={{ color: textPrimary }}>{inv.note_count}</td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono" style={{ color: textPrimary }}>{inv.action_count}</span>
                        {(inv.overdue_actions ?? 0) > 0 && (
                          <span className="ml-1 text-danger text-[13px]">({inv.overdue_actions} overdue)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function InvestigationDetail({ id, onOpenElectrode, refetchList }: { id: number; onOpenElectrode: (gpn: string) => void; refetchList: () => void }) {
  const { data, loading, refetch } = useApi(() => api.getInvestigation(id), [id]);
  const { data: similarData, loading: similarLoading } = useApi(() => api.getSimilarCases(id), [id]);
  const [noteText, setNoteText] = useState('');
  const [updating, setUpdating] = useState(false);
  const { isDark } = useTheme();
  const card = useCardClass();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      const DEMO_USER = 'Demo Operator'; // TODO: Replace with auth system user
      await api.addNote(id, { author: DEMO_USER, note_text: noteText });
      setNoteText('');
      refetch();
    } catch (err) {
      console.error('Failed to add note:', err);
      alert('Failed to add note. Please try again.');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.updateInvestigation(id, { status: newStatus });
      refetch();
      refetchList();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleActionStatus = async (actionId: number, newStatus: string) => {
    try {
      await api.updateAction(actionId, { status: newStatus });
      refetch();
    } catch (err) {
      console.error('Failed to update action:', err);
      alert('Failed to update action status. Please try again.');
    }
  };

  if (loading) return <div className="space-y-5"><SkeletonCard height="h-36" /><SkeletonCard height="h-52" /></div>;
  if (!data?.investigation) return <div style={{ color: textMuted }}>Investigation not found</div>;

  const { investigation: inv, notes, actions } = data;
  const electrode_cost = (data as any).electrode_cost as number | null;
  const total_run_defect_cost = (data as any).total_run_defect_cost as number | null;

  const statusFlow = ['open', 'in_progress', 'closed', 'verified'];
  const currentIdx = statusFlow.indexOf(inv.status);
  const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold" style={{ color: textPrimary }}>Investigation #{inv.investigation_id}</h2>
              <StatusBadge status={inv.status} size="md" />
            </div>
            <div className="text-sm mt-1" style={{ color: textMuted }}>
              {inv.defect_code} at {inv.defect_site} · Assigned to {inv.assigned_to}
              {electrode_cost != null && electrode_cost > 0 && (
                <span className="ml-2 font-mono" style={{ color: '#f59e0b' }}>
                  · ${formatCostFull(electrode_cost)} electrode
                </span>
              )}
              {total_run_defect_cost != null && total_run_defect_cost > 0 && (
                <span className="ml-2 font-mono" style={{ color: '#f59e0b' }}>
                  · ${formatCost(total_run_defect_cost)} run cost
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {inv.gpn && (
              <button onClick={() => onOpenElectrode(inv.gpn)}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                style={{
                  background: isDark ? '#111520' : '#f0f1f4',
                  borderColor: isDark ? '#252a3a' : '#e2e5eb',
                  color: textSecondary,
                }}>
                View Electrode
              </button>
            )}
            {nextStatus && (
              <button onClick={() => handleStatusChange(nextStatus)} disabled={updating}
                className="px-5 py-3 text-sm font-semibold rounded-lg border transition-colors disabled:opacity-50"
                style={{
                  borderColor: isDark ? '#6b728060' : '#d0d3db',
                  color: textPrimary,
                }}>
                Move to {nextStatus.replace(/_/g, ' ')}
              </button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 text-sm">
          <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
            <div className="text-[13px]" style={{ color: textMuted }}>GPN</div>
            <div className="font-mono mt-1" style={{ color: textPrimary }}>{inv.gpn}</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
            <div className="text-[13px]" style={{ color: textMuted }}>Root Cause</div>
            <div className="mt-1" style={{ color: textPrimary }}>{inv.root_cause_category}</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
            <div className="text-[13px]" style={{ color: textMuted }}>Created</div>
            <div className="mt-1" style={{ color: textPrimary }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
            <div className="text-[13px]" style={{ color: textMuted }}>Due Date</div>
            <div className={`mt-1 ${inv.due_date && new Date(inv.due_date) < new Date() && !['closed','verified'].includes(inv.status) ? 'text-danger font-medium' : ''}`}
              style={{ color: inv.due_date && new Date(inv.due_date) < new Date() && !['closed','verified'].includes(inv.status) ? undefined : textPrimary }}>
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
        {inv.root_cause_detail && (
          <div className="mt-4 text-sm rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4', color: textSecondary }}>
            <span style={{ color: textMuted }}>Detail: </span>{inv.root_cause_detail}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Notes */}
        <div className={`${card} p-6`}>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: textSecondary }}>
            <MessageSquare size={16} /> Notes ({notes.length})
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
            {notes.map((n: Note) => (
              <div key={n.note_id} className="rounded-lg p-4" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: textPrimary }}>{n.author}</span>
                  <span className="text-[13px]" style={{ color: textMuted }}>{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{n.note_text}</p>
              </div>
            ))}
            {notes.length === 0 && <div className="text-sm text-center py-6" style={{ color: textMuted }}>No notes yet</div>}
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: textSecondary }}>Add a note</label>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Describe findings, observations, or next steps..."
              rows={4}
              className="w-full border-2 rounded-lg px-4 py-3 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-y outline-none"
              style={{
                background: isDark ? '#111520' : '#ffffff',
                borderColor: isDark ? '#252a3a' : '#e2e5eb',
                color: textPrimary,
              }}
              onKeyDown={e => e.key === 'Enter' && e.metaKey && handleAddNote()} />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[13px]" style={{ color: textMuted }}>Cmd+Enter to submit</span>
              <button onClick={handleAddNote}
                className="px-5 py-3 text-sm bg-accent text-black rounded-lg font-semibold hover:bg-accent/90 transition-colors">
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Corrective Actions */}
        <div className={`${card} p-6`}>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: textSecondary }}>
            <CheckCircle2 size={16} /> Corrective Actions ({actions.length})
          </h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
            {actions.map((a: CorrectiveAction) => {
              const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !['completed', 'verified'].includes(a.status);
              const actionStatusFlow = ['open', 'in_progress', 'completed'];
              const nextActionStatus = actionStatusFlow[actionStatusFlow.indexOf(a.status) + 1];

              return (
                <div key={a.action_id} className={`border rounded-lg p-5 ${
                  isOverdue ? 'border-danger/30 bg-danger-dim/20' : ''
                }`} style={{ borderColor: isOverdue ? undefined : isDark ? '#252a3a60' : '#e2e5eb' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ color: textPrimary }}>{a.title}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.priority || 'medium'} />
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  <div className="text-sm mb-3" style={{ color: textMuted }}>{a.description}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[13px]" style={{ color: textMuted }}>
                      <span>{a.assigned_to}</span>
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger' : ''}`}>
                        <Clock size={13} />
                        {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                      </span>
                      {a.expected_savings && (
                        <span className="font-mono">${(a.expected_savings / 1000).toFixed(0)}k est.</span>
                      )}
                    </div>
                    {nextActionStatus && (
                      <button onClick={() => handleActionStatus(a.action_id, nextActionStatus)}
                        className="px-4 py-2 text-[13px] rounded-lg border transition-colors"
                        style={{
                          background: isDark ? '#111520' : '#f0f1f4',
                          borderColor: isDark ? '#252a3a' : '#e2e5eb',
                          color: textSecondary,
                        }}>
                        → {nextActionStatus.replace(/_/g, ' ')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      {similarData && similarData.recommendations && similarData.recommendations.length > 0 && (
        <AiGradientSection title="Recommended Actions" label="AI-Suggested" loading={similarLoading}>
          <div className="space-y-3">
            {similarData.recommendations.map((rec: Recommendation) => (
              <div key={rec.action_type}
                className={`rounded-lg p-4 border-l-4 ${
                  rec.is_recommended ? 'border-l-emerald-500' :
                  rec.is_ineffective ? 'border-l-red-500' :
                  'border-l-gray-500'
                }`}
                style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize" style={{ color: textPrimary }}>
                      {rec.action_type}
                    </span>
                    {rec.is_recommended && (
                      <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400 font-semibold">Recommended</span>
                    )}
                    {rec.is_ineffective && (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 font-semibold">Not Effective</span>
                    )}
                  </div>
                  <span className="text-xs font-mono" style={{ color: textMuted }}>
                    {rec.verified_effective} of {rec.total_count} effective
                  </span>
                </div>

                {rec.avg_improvement_pct !== null && (
                  <div className="text-[13px] mb-2" style={{ color: textSecondary }}>
                    Avg {rec.avg_improvement_pct > 0 ? '' : '-'}{Math.abs(rec.avg_improvement_pct)}% defect rate {rec.avg_improvement_pct > 0 ? 'reduction' : 'increase'}
                    {(rec as any).avg_cost_savings != null && (rec as any).avg_cost_savings > 0 && (
                      <span className="ml-2 font-mono" style={{ color: '#f59e0b' }}>
                        · avg savings: ${formatCost((rec as any).avg_cost_savings)} per occurrence
                      </span>
                    )}
                  </div>
                )}

                {/* Success rate bar */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 rounded-full h-2" style={{ background: isDark ? '#252a3a' : '#e2e5eb' }}>
                    <div
                      className={`h-full rounded-full ${
                        rec.success_rate >= 0.6 ? 'bg-emerald-500' :
                        rec.success_rate >= 0.3 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(rec.success_rate * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-10 text-right" style={{ color: textMuted }}>
                    {Math.round(rec.success_rate * 100)}%
                  </span>
                </div>

                {rec.example_titles.length > 0 && (
                  <div className="text-xs" style={{ color: textMuted }}>
                    Examples: {rec.example_titles.map((t, i) => (
                      <span key={i}>{i > 0 ? ', ' : ''}"{t}"</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs italic pt-1" style={{ color: textMuted }}>
              Recommendations based on historical corrective action outcomes. Verify applicability with process engineering.
            </div>
            <div className="text-xs" style={{ color: textMuted }}>
              Based on {similarData.similar_cases.length} similar past investigation{similarData.similar_cases.length !== 1 ? 's' : ''}
            </div>
          </div>
        </AiGradientSection>
      )}

      {/* Similar Cases (AI Feature B) */}
      <AiGradientSection title="Similar Past Investigations" label="AI-Suggested" loading={similarLoading}>
        {similarData && similarData.similar_cases.length > 0 ? (
          <div className="space-y-3">
            {similarData.similar_cases.map((sc: SimilarCase) => (
              <div key={sc.investigation.investigation_id} className="rounded-lg p-4 text-[13px]"
                style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold" style={{ color: textPrimary }}>#{sc.investigation.investigation_id}</span>
                    <span style={{ color: textSecondary }}>{sc.investigation.defect_code}</span>
                    <StatusBadge status={sc.investigation.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" style={{ color: textMuted }}>Score: {sc.match_score}/3</span>
                  </div>
                </div>
                <div className="mb-1" style={{ color: textMuted }}>{sc.match_explanation}</div>
                {sc.investigation.root_cause_category && (
                  <div style={{ color: textSecondary }}>
                    Root cause: {sc.investigation.root_cause_category}
                    {sc.investigation.root_cause_detail && ` — ${sc.investigation.root_cause_detail}`}
                  </div>
                )}
                {sc.investigation.corrective_action && (
                  <div className="mt-1" style={{ color: textSecondary }}>
                    Action taken: {sc.investigation.corrective_action}
                  </div>
                )}
                {sc.effective_action && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 text-xs rounded bg-success-dim text-success font-semibold">Recommended Action</span>
                    <span className="text-success text-[13px]">{sc.effective_action}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="text-xs italic pt-1" style={{ color: textMuted }}>
              Similarity based on historical data patterns. Verify applicability.
            </div>
          </div>
        ) : !similarLoading ? (
          <div className="text-[13px] text-center py-4" style={{ color: textMuted }}>No similar investigations found with 2+ matching attributes.</div>
        ) : null}
      </AiGradientSection>
    </div>
  );
}

function ElectrodeDetail({ gpn, onOpenInvestigation }: { gpn: string; onOpenInvestigation: (id: number) => void }) {
  const { data, loading } = useApi(() => api.getElectrode(gpn), [gpn]);
  const { isDark } = useTheme();
  const card = useCardClass();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  const investigationId = data?.investigations?.[0]?.investigation_id ?? null;
  const { data: aiData, loading: aiLoading } = useApi(
    () => investigationId ? api.getAiAnalysis(investigationId) : Promise.resolve(null),
    [investigationId],
  );

  if (loading) return <div className="space-y-5"><SkeletonCard height="h-28" /><SkeletonCard height="h-20" /><SkeletonCard height="h-52" /></div>;
  if (!data?.electrode) return <div style={{ color: textMuted }}>Electrode not found</div>;

  const { electrode, bake_run, siblings, risk_factors, lifecycle, investigations } = data;

  return (
    <div className="space-y-8">
      {/* Electrode header */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-mono" style={{ color: textPrimary }}>{electrode.gpn}</h2>
            <div className="text-sm mt-1" style={{ color: textMuted }}>
              Lot: {electrode.lot} · Diameter: {electrode.diameter}mm · Weight: {electrode.weight_kg}kg · Blend: {electrode.coke_blend}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(electrode.defect_code_ob || electrode.defect_code_og || electrode.defect_code_of) ? (
              <StatusBadge status="defect" size="md" />
            ) : (
              <StatusBadge status="clean" size="md" />
            )}
          </div>
        </div>
      </div>

      {/* 10-step lifecycle timeline */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: textSecondary }}>Manufacturing Lifecycle</h3>
          <div className="flex items-center gap-4 text-[13px]" style={{ color: textMuted }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/20 border-2 border-emerald-500"></span> Clean</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500/20 border-2 border-red-500"></span> Defect Detected</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2" style={{ background: isDark ? '#141824' : '#f0f1f4', borderColor: isDark ? '#3a3d4a' : '#d0d3db' }}></span> No Data</span>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-0 min-w-[1000px]">
            {lifecycle.map((step: LifecycleStep, i: number) => {
              const isDefect = step.status === 'defect';
              const isClean = step.status === 'clean';
              const nodeStyle = isDefect
                ? 'bg-red-500/15 border-2 border-red-500/60'
                : isClean
                ? 'bg-emerald-500/15 border-2 border-emerald-500/60'
                : isDark
                ? 'bg-[#141824] border-2 border-[#3a3d4a]'
                : 'bg-[#f0f1f4] border-2 border-[#d0d3db]';
              const labelColor = isDefect ? 'text-red-400' : isClean ? 'text-emerald-400' : '';

              return (
                <div key={i} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-1 rounded-lg px-3 py-4 text-center min-h-[76px] flex flex-col items-center justify-center ${nodeStyle}`}>
                    <div className={`text-[13px] font-semibold ${labelColor} leading-tight`}
                      style={{ color: !isDefect && !isClean ? textMuted : undefined }}>
                      {step.step_name}
                    </div>
                    {step.run_number && (
                      <div className="text-[13px] font-mono mt-1" style={{ color: textMuted }}>{step.run_number}</div>
                    )}
                    {step.furnace && (
                      <div className="text-[13px]" style={{ color: textMuted }}>{step.furnace}</div>
                    )}
                    {step.defect_code && (
                      <div className="text-[13px] font-mono font-bold text-red-400 mt-1">{step.defect_code}</div>
                    )}
                  </div>
                  {i < lifecycle.length - 1 && (
                    <div className="w-6 flex items-center justify-center flex-shrink-0" style={{ color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }}>
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M0 5h13M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk Factors */}
        <div className={`${card} p-6`}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: textSecondary }}>Risk Factor Attribution</h3>
          <div className="space-y-2 text-sm">
            {[
              { name: 'Furnace', value: electrode.furnace_og || bake_run?.furnace, level: bake_run?.furnace },
              { name: 'Position', value: electrode.position_og ? `Position ${electrode.position_og}` : (electrode.car_deck_ob ? `Deck ${electrode.car_deck_ob}` : null) },
              { name: 'Profile', value: electrode.profile_og || bake_run?.profile },
              { name: 'Blend', value: electrode.coke_blend },
              { name: 'Diameter', value: electrode.diameter ? `${electrode.diameter}mm` : null },
            ].filter(f => f.value).map(f => {
              const matchedFactor = risk_factors.find((rf: RiskFactor) =>
                rf.factor_level?.includes(f.value?.toString()?.slice(0, 3) ?? '')
              );
              const riskGroup = matchedFactor?.risk_group || 'low';

              return (
                <div key={f.name} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                  <div>
                    <span style={{ color: textMuted }}>{f.name}:</span>
                    <span className="ml-2 font-medium" style={{ color: textPrimary }}>{f.value}</span>
                  </div>
                  <StatusBadge status={riskGroup} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Sibling Electrodes */}
        <div className={`${card} p-6`}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: textSecondary }}>
            Sibling Electrodes (same graphite run: {electrode.run_number_og})
          </h3>
          <div className="max-h-[250px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: isDark ? '#141824' : '#ffffff' }}>
                <tr className="text-xs uppercase tracking-wider font-semibold" style={{
                  color: textMuted,
                  borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
                }}>
                  <th className="px-3 py-2.5 text-left">Pos</th>
                  <th className="px-3 py-2.5 text-left">GPN</th>
                  <th className="px-3 py-2.5 text-left">Lot</th>
                  <th className="px-3 py-2.5 text-center">Defect</th>
                </tr>
              </thead>
              <tbody>
                {siblings.map((s: Sibling) => (
                  <tr key={s.gpn} className="hover:bg-bg-card-hover"
                    style={{ borderBottom: `1px solid ${isDark ? '#252a3a30' : '#e2e5eb'}` }}>
                    <td className="px-3 py-2.5 font-mono" style={{ color: textPrimary }}>{s.position_og}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: textSecondary }}>{s.gpn?.slice(0, 12)}</td>
                    <td className="px-3 py-2.5" style={{ color: textMuted }}>{s.lot}</td>
                    <td className="px-3 py-2.5 text-center">
                      {(s.defect_code_og || s.defect_code_of) ? (
                        <span className="text-danger font-mono">{s.defect_code_og || s.defect_code_of}</span>
                      ) : (
                        <StatusBadge status="clean" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {siblings.length > 0 && (
            <div className="mt-3 text-[13px] flex items-center justify-between" style={{ color: textMuted }}>
              <span>{siblings.filter((s: Sibling) => s.defect_code_og || s.defect_code_of).length} of {siblings.length} siblings also defective</span>
              {(data as any).total_run_defect_cost > 0 && (
                <span className="font-mono flex items-center gap-1" style={{ color: '#f59e0b' }}>
                  <DollarSign size={13} />
                  {formatCost((data as any).total_run_defect_cost)} total run defect cost
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {investigationId && (
        <AiAnalysisSection data={aiData} loading={aiLoading} />
      )}

      {/* Existing investigations for this GPN */}
      {investigations.length > 0 && (
        <div className={`${card} p-6`}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: textSecondary }}>Existing Investigations</h3>
          <div className="space-y-2">
            {investigations.map((inv: Investigation) => (
              <div key={inv.investigation_id} onClick={() => onOpenInvestigation(inv.investigation_id)}
                className="flex items-center justify-between p-3.5 rounded-lg cursor-pointer hover:bg-bg-card-hover border transition-colors"
                style={{ borderColor: isDark ? '#252a3a50' : '#e2e5eb' }}>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className="font-mono font-medium" style={{ color: textPrimary }}>#{inv.investigation_id}</span>
                  <span style={{ color: textMuted }}>{inv.root_cause_category}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <span className="text-[13px]" style={{ color: textMuted }}>
                  {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== AI UI Components ==================== */

function AiGradientSection({ title, label, loading, children }: {
  title: string;
  label: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const { isDark } = useTheme();
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <div className="rounded-xl p-[1px] bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-amber-500/30">
      <div className="rounded-xl p-5" style={{ background: isDark ? '#141824' : '#ffffff' }}>
        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: textSecondary }}>
            <Sparkles size={14} className="text-amber-400" />
            {title}
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold ml-1">{label}</span>
          </h3>
          <button className="text-[13px] hover:text-text-primary" style={{ color: textMuted }}>
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        {expanded && (
          loading ? (
            <div className="space-y-3">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-5 w-full rounded" />
              <div className="skeleton h-5 w-5/6 rounded" />
            </div>
          ) : children
        )}
      </div>
    </div>
  );
}

function AiAnalysisSection({ data, loading }: { data: AiAnalysisResponse | null; loading: boolean }) {
  const { isDark } = useTheme();
  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <AiGradientSection title="AI Analysis" label="AI-Generated" loading={loading}>
      {data ? (
        <div className="space-y-3">
          {/* Confidence */}
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: textMuted }}>Confidence:</span>
            <div className="flex-1 max-w-[120px] rounded-full h-3" style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${(data.confidence * 100)}%` }}
              />
            </div>
            <span className="font-mono" style={{ color: textPrimary }}>{(data.confidence * 100).toFixed(0)}%</span>
          </div>

          {/* Analysis text */}
          <div className="text-[13px] whitespace-pre-line" style={{ lineHeight: 1.6, color: textSecondary }}>
            {data.analysis}
          </div>

          {/* Factors */}
          {data.factors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: textMuted }}>Contributing Factors</div>
              {data.factors.map((f: AiAnalysisFactor, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[13px] rounded-lg p-3"
                  style={{ background: isDark ? '#111520' : '#f0f1f4' }}>
                  <span className={`px-2 py-0.5 text-xs rounded font-semibold shrink-0 ${
                    f.impact === 'high' ? 'bg-danger-dim text-danger' :
                    f.impact === 'medium' ? 'bg-warning-dim text-warning' :
                    'bg-success-dim text-success'
                  }`}>{f.impact}</span>
                  <div>
                    <div className="font-semibold" style={{ color: textPrimary }}>{f.name}</div>
                    <div className="mt-0.5" style={{ color: textMuted }}>{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-amber-500/[0.08] border-l-[3px] border-l-amber-500 rounded-r-md p-4 text-[13px]">
            <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-1">Recommendation</div>
            <div style={{ color: textPrimary }}>{data.recommendation}</div>
          </div>

          {/* Disclaimer */}
          <div className="text-xs italic pt-1" style={{ color: textMuted }}>
            Generated from historical data patterns. Verify with process engineering.
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-center py-4" style={{ color: textMuted }}>No analysis available for this electrode.</div>
      )}
    </AiGradientSection>
  );
}
