import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SkeletonTable, SkeletonCard } from '../components/LoadingSkeleton';
import StatusBadge from '../components/StatusBadge';
import { Search, MessageSquare, CheckCircle2, Clock, ChevronRight, Sparkles } from 'lucide-react';
import type {
  InvestigationsResponse, Investigation,
  Note, CorrectiveAction, LifecycleStep,
  Sibling, RiskFactor, ElectrodeSearchResult,
  AiAnalysisResponse, AiAnalysisFactor, SimilarCase,
} from '../types';

type View = 'list' | 'detail' | 'electrode';

export default function Investigations() {
  const [view, setView] = useState<View>('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvId, setSelectedInvId] = useState<number | null>(null);
  const [selectedGpn, setSelectedGpn] = useState<string | null>(null);

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

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Investigation Workflow</h1>
        {view !== 'list' && (
          <button onClick={() => setView('list')}
            className="text-xs text-accent hover:underline">← Back to list</button>
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

  return (
    <>
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by GPN, lot, or run number..."
            className="w-full bg-bg-input border border-border rounded-md pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50" />
        </div>
        <div className="flex gap-1">
          {['', 'open', 'in_progress', 'closed', 'verified'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
                statusFilter === s ? 'bg-accent text-black' : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && searchResults.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-3">
          <h3 className="text-xs font-medium text-text-muted mb-2">Search Results ({searchResults.length})</h3>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {searchResults.map((e: ElectrodeSearchResult) => (
              <div key={e.gpn} onClick={() => onOpenElectrode(e.gpn)}
                className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-bg-card-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-text-primary">{e.gpn}</span>
                  <span className="text-xs text-text-muted">{e.lot}</span>
                  <span className="text-xs text-text-muted">{e.furnace_og}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(e.defect_code_ob || e.defect_code_og || e.defect_code_of) ? (
                    <StatusBadge status="defect" />
                  ) : (
                    <StatusBadge status="clean" />
                  )}
                  <ChevronRight size={14} className="text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation table */}
      <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
        {invLoading ? <div className="p-4"><SkeletonTable rows={8} /></div> : (
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-card border-b border-border">
                <tr className="text-text-muted uppercase tracking-wider">
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">GPN</th>
                  <th className="px-3 py-2 text-left">Defect</th>
                  <th className="px-3 py-2 text-left">Site</th>
                  <th className="px-3 py-2 text-left">Root Cause</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-left">Assigned</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Notes</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv: Investigation) => {
                  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !['closed', 'verified'].includes(inv.status);
                  return (
                    <tr key={inv.investigation_id} onClick={() => onOpenInvestigation(inv.investigation_id)}
                      className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-bg-card-hover ${
                        isOverdue ? 'bg-danger-dim/20' : ''
                      }`}>
                      <td className="px-3 py-2 font-mono text-text-primary">#{inv.investigation_id}</td>
                      <td className="px-3 py-2 font-mono text-accent">{inv.gpn?.slice(0, 12)}</td>
                      <td className="px-3 py-2 text-text-secondary">{inv.defect_code}</td>
                      <td className="px-3 py-2 text-text-secondary">{inv.defect_site}</td>
                      <td className="px-3 py-2 text-text-secondary">{inv.root_cause_category}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={inv.status} /></td>
                      <td className="px-3 py-2 text-text-secondary">{inv.assigned_to}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${isOverdue ? 'text-danger font-medium' : 'text-text-muted'}`}>
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{inv.note_count}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono">{inv.action_count}</span>
                        {(inv.overdue_actions ?? 0) > 0 && (
                          <span className="ml-1 text-danger text-[10px]">({inv.overdue_actions} overdue)</span>
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

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await api.addNote(id, { author: 'Current User', note_text: noteText });
    setNoteText('');
    refetch();
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    await api.updateInvestigation(id, { status: newStatus });
    refetch();
    refetchList();
    setUpdating(false);
  };

  const handleActionStatus = async (actionId: number, newStatus: string) => {
    await api.updateAction(actionId, { status: newStatus });
    refetch();
  };

  if (loading) return <div className="space-y-4"><SkeletonCard height="h-32" /><SkeletonCard height="h-48" /></div>;
  if (!data?.investigation) return <div className="text-text-muted">Investigation not found</div>;

  const { investigation: inv, notes, actions } = data;

  const statusFlow = ['open', 'in_progress', 'closed', 'verified'];
  const currentIdx = statusFlow.indexOf(inv.status);
  const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">Investigation #{inv.investigation_id}</h2>
              <StatusBadge status={inv.status} size="md" />
            </div>
            <div className="text-sm text-text-muted mt-1">
              {inv.defect_code} at {inv.defect_site} · Assigned to {inv.assigned_to}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {inv.gpn && (
              <button onClick={() => onOpenElectrode(inv.gpn)}
                className="px-3 py-1.5 text-xs bg-bg-input border border-border rounded hover:border-accent/50 text-text-secondary hover:text-accent transition-colors">
                View Electrode
              </button>
            )}
            {nextStatus && (
              <button onClick={() => handleStatusChange(nextStatus)} disabled={updating}
                className="px-3 py-1.5 text-xs bg-accent text-black rounded font-medium hover:bg-accent/90 disabled:opacity-50">
                Move to {nextStatus.replace(/_/g, ' ')}
              </button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="bg-bg-input rounded p-2">
            <div className="text-text-muted">GPN</div>
            <div className="font-mono text-text-primary mt-0.5">{inv.gpn}</div>
          </div>
          <div className="bg-bg-input rounded p-2">
            <div className="text-text-muted">Root Cause</div>
            <div className="text-text-primary mt-0.5">{inv.root_cause_category}</div>
          </div>
          <div className="bg-bg-input rounded p-2">
            <div className="text-text-muted">Created</div>
            <div className="text-text-primary mt-0.5">{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}</div>
          </div>
          <div className="bg-bg-input rounded p-2">
            <div className="text-text-muted">Due Date</div>
            <div className={`mt-0.5 ${inv.due_date && new Date(inv.due_date) < new Date() && !['closed','verified'].includes(inv.status) ? 'text-danger font-medium' : 'text-text-primary'}`}>
              {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
        {inv.root_cause_detail && (
          <div className="mt-3 text-xs text-text-secondary bg-bg-input rounded p-2">
            <span className="text-text-muted">Detail: </span>{inv.root_cause_detail}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5 mb-3">
            <MessageSquare size={14} /> Notes ({notes.length})
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto mb-3">
            {notes.map((n: Note) => (
              <div key={n.note_id} className="bg-bg-input rounded p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-text-primary">{n.author}</span>
                  <span className="text-text-muted">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="text-text-secondary">{n.note_text}</p>
              </div>
            ))}
            {notes.length === 0 && <div className="text-text-muted text-xs text-center py-3">No notes yet</div>}
          </div>
          <div className="flex gap-2">
            <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 bg-bg-input border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
            <button onClick={handleAddNote}
              className="px-3 py-1.5 text-xs bg-accent text-black rounded font-medium hover:bg-accent/90">
              Add
            </button>
          </div>
        </div>

        {/* Corrective Actions */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5 mb-3">
            <CheckCircle2 size={14} /> Corrective Actions ({actions.length})
          </h3>
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {actions.map((a: CorrectiveAction) => {
              const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !['completed', 'verified'].includes(a.status);
              const actionStatusFlow = ['open', 'in_progress', 'completed'];
              const nextActionStatus = actionStatusFlow[actionStatusFlow.indexOf(a.status) + 1];

              return (
                <div key={a.action_id} className={`border rounded p-2.5 text-xs ${
                  isOverdue ? 'border-danger/30 bg-danger-dim/20' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-text-primary">{a.title}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={a.priority || 'medium'} />
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  <div className="text-text-muted mb-1">{a.description}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-text-muted">
                      <span>{a.assigned_to}</span>
                      <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-danger' : ''}`}>
                        <Clock size={10} />
                        {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                      </span>
                      {a.expected_savings && (
                        <span className="font-mono">${(a.expected_savings / 1000).toFixed(0)}k est.</span>
                      )}
                    </div>
                    {nextActionStatus && (
                      <button onClick={() => handleActionStatus(a.action_id, nextActionStatus)}
                        className="px-2 py-0.5 text-[10px] bg-bg-input border border-border rounded hover:border-accent/50 text-text-secondary hover:text-accent">
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

      {/* Similar Cases (AI Feature B) */}
      <AiGradientSection title="Similar Past Investigations" label="AI-Suggested" loading={similarLoading}>
        {similarData && similarData.similar_cases.length > 0 ? (
          <div className="space-y-3">
            {similarData.similar_cases.map((sc: SimilarCase) => (
              <div key={sc.investigation.investigation_id} className="bg-bg-input rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-primary font-medium">#{sc.investigation.investigation_id}</span>
                    <span className="text-text-secondary">{sc.investigation.defect_code}</span>
                    <StatusBadge status={sc.investigation.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-muted">Score: {sc.match_score}/3</span>
                  </div>
                </div>
                <div className="text-text-muted mb-1">{sc.match_explanation}</div>
                {sc.investigation.root_cause_category && (
                  <div className="text-text-secondary">
                    Root cause: {sc.investigation.root_cause_category}
                    {sc.investigation.root_cause_detail && ` — ${sc.investigation.root_cause_detail}`}
                  </div>
                )}
                {sc.investigation.corrective_action && (
                  <div className="text-text-secondary mt-1">
                    Action taken: {sc.investigation.corrective_action}
                  </div>
                )}
                {sc.effective_action && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-success-dim text-success font-medium">Recommended Action</span>
                    <span className="text-success text-[11px]">{sc.effective_action}</span>
                  </div>
                )}
              </div>
            ))}
            <div className="text-[10px] text-text-muted italic pt-1">
              Similarity based on historical data patterns. Verify applicability.
            </div>
          </div>
        ) : !similarLoading ? (
          <div className="text-xs text-text-muted text-center py-4">No similar investigations found with 2+ matching attributes.</div>
        ) : null}
      </AiGradientSection>
    </div>
  );
}

function ElectrodeDetail({ gpn, onOpenInvestigation }: { gpn: string; onOpenInvestigation: (id: number) => void }) {
  const { data, loading } = useApi(() => api.getElectrode(gpn), [gpn]);

  // Find investigation ID for this electrode to fetch AI analysis
  const investigationId = data?.investigations?.[0]?.investigation_id ?? null;
  const { data: aiData, loading: aiLoading } = useApi(
    () => investigationId ? api.getAiAnalysis(investigationId) : Promise.resolve(null),
    [investigationId],
  );

  if (loading) return <div className="space-y-4"><SkeletonCard height="h-24" /><SkeletonCard height="h-16" /><SkeletonCard height="h-48" /></div>;
  if (!data?.electrode) return <div className="text-text-muted">Electrode not found</div>;

  const { electrode, bake_run, siblings, risk_factors, lifecycle, investigations } = data;

  return (
    <div className="space-y-4">
      {/* Electrode header */}
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold font-mono text-text-primary">{electrode.gpn}</h2>
            <div className="text-xs text-text-muted mt-1">
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
      <div className="bg-bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-4">Manufacturing Lifecycle</h3>
        <div className="overflow-x-auto">
          <div className="flex items-start gap-1 min-w-[900px]">
            {lifecycle.map((step: LifecycleStep, i: number) => {
              const isDefect = step.status === 'defect';
              const isClean = step.status === 'clean';
              const bgColor = isDefect ? 'bg-danger-dim border-danger/40' :
                isClean ? 'bg-success-dim border-success/30' :
                'bg-bg-input border-border';
              const textColor = isDefect ? 'text-danger' : isClean ? 'text-success' : 'text-text-muted';

              return (
                <div key={i} className="flex items-center flex-1 min-w-0">
                  <div className={`flex-1 border rounded-md p-2 text-center ${bgColor}`}>
                    <div className={`text-[10px] font-medium ${textColor} leading-tight`}>{step.step_name}</div>
                    {step.run_number && (
                      <div className="text-[9px] font-mono text-text-muted mt-0.5">{step.run_number}</div>
                    )}
                    {step.furnace && (
                      <div className="text-[9px] text-text-muted">{step.furnace}</div>
                    )}
                    {step.defect_code && (
                      <div className="text-[9px] font-mono text-danger mt-0.5">{step.defect_code}</div>
                    )}
                  </div>
                  {i < lifecycle.length - 1 && (
                    <div className="w-3 flex items-center justify-center text-text-muted flex-shrink-0">→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success-dim border border-success/30"></span> Clean</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-danger-dim border border-danger/40"></span> Defect</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-bg-input border border-border"></span> No Data</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Factors */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Risk Factor Attribution</h3>
          <div className="space-y-2 text-xs">
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
                <div key={f.name} className="flex items-center justify-between p-2 rounded bg-bg-input">
                  <div>
                    <span className="text-text-muted">{f.name}:</span>
                    <span className="ml-2 text-text-primary font-medium">{f.value}</span>
                  </div>
                  <StatusBadge status={riskGroup} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Factors right side is blank — AI Analysis goes here in a full-width section below */}
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Sibling Electrodes (same graphite run: {electrode.run_number_og})
          </h3>
          <div className="max-h-[250px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-card">
                <tr className="text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="px-2 py-1 text-left">Pos</th>
                  <th className="px-2 py-1 text-left">GPN</th>
                  <th className="px-2 py-1 text-left">Lot</th>
                  <th className="px-2 py-1 text-center">Defect</th>
                </tr>
              </thead>
              <tbody>
                {siblings.map((s: Sibling) => (
                  <tr key={s.gpn} className="border-b border-border/30 hover:bg-bg-card-hover">
                    <td className="px-2 py-1 font-mono">{s.position_og}</td>
                    <td className="px-2 py-1 font-mono text-text-secondary">{s.gpn?.slice(0, 12)}</td>
                    <td className="px-2 py-1 text-text-muted">{s.lot}</td>
                    <td className="px-2 py-1 text-center">
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
            <div className="mt-2 text-[10px] text-text-muted">
              {siblings.filter((s: Sibling) => s.defect_code_og || s.defect_code_of).length} of {siblings.length} siblings also defective
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis (Mock GenAI Feature A) — AFTER lifecycle/risk, BEFORE sibling analysis */}
      {investigationId && (
        <AiAnalysisSection data={aiData} loading={aiLoading} />
      )}

      {/* Existing investigations for this GPN */}
      {investigations.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">Existing Investigations</h3>
          <div className="space-y-1">
            {investigations.map((inv: Investigation) => (
              <div key={inv.investigation_id} onClick={() => onOpenInvestigation(inv.investigation_id)}
                className="flex items-center justify-between p-2.5 rounded cursor-pointer hover:bg-bg-card-hover border border-border/50">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-text-primary">#{inv.investigation_id}</span>
                  <span className="text-text-muted">{inv.root_cause_category}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <span className="text-xs text-text-muted">
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

  return (
    <div className="rounded-lg p-[1px] bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-amber-500/30">
      <div className="bg-bg-card rounded-lg p-4">
        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            {title}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium ml-1">{label}</span>
          </h3>
          <button className="text-xs text-text-muted hover:text-text-primary">
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        {expanded && (
          loading ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          ) : children
        )}
      </div>
    </div>
  );
}

function AiAnalysisSection({ data, loading }: { data: AiAnalysisResponse | null; loading: boolean }) {
  return (
    <AiGradientSection title="AI Analysis" label="AI-Generated" loading={loading}>
      {data ? (
        <div className="space-y-3">
          {/* Confidence */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Confidence:</span>
            <div className="flex-1 max-w-[120px] bg-bg-input rounded-full h-1.5">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${(data.confidence * 100)}%` }}
              />
            </div>
            <span className="font-mono text-text-primary">{(data.confidence * 100).toFixed(0)}%</span>
          </div>

          {/* Analysis text */}
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {data.analysis}
          </div>

          {/* Factors */}
          {data.factors.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Contributing Factors</div>
              {data.factors.map((f: AiAnalysisFactor, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-bg-input rounded p-2">
                  <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium shrink-0 ${
                    f.impact === 'high' ? 'bg-danger-dim text-danger' :
                    f.impact === 'medium' ? 'bg-warning-dim text-warning' :
                    'bg-success-dim text-success'
                  }`}>{f.impact}</span>
                  <div>
                    <div className="font-medium text-text-primary">{f.name}</div>
                    <div className="text-text-muted mt-0.5">{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2.5 text-xs">
            <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Recommendation</div>
            <div className="text-text-primary">{data.recommendation}</div>
          </div>

          {/* Disclaimer */}
          <div className="text-[10px] text-text-muted italic pt-1">
            Generated from historical data patterns. Verify with process engineering.
          </div>
        </div>
      ) : (
        <div className="text-xs text-text-muted text-center py-4">No analysis available for this electrode.</div>
      )}
    </AiGradientSection>
  );
}
