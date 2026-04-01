import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, MessageSquare, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useTheme } from '../App';
import StatusBadge from './StatusBadge';
import type { KnowledgeSearchResponse, KnowledgeSearchResult } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export default function KnowledgeSearch({ open, onClose, onNavigate }: Props) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const textPrimary = isDark ? '#e5e7eb' : '#1a1d2b';
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [open]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.searchKnowledge(q).then(res => {
      setResults(res);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const handleResultClick = (investigationId: number) => {
    onClose();
    if (onNavigate) {
      onNavigate(`/investigations?id=${investigationId}`);
    }
  };

  if (!open) return null;

  const totalResults = results?.total_results || 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 top-[10%] mx-auto z-50 w-full max-w-2xl"
        style={{ maxHeight: '75vh' }}>
        <div className="rounded-xl shadow-2xl overflow-hidden border"
          style={{
            background: isDark ? '#141824' : '#ffffff',
            borderColor: isDark ? '#252a3a' : '#e2e5eb',
          }}>

          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}>
            <Search size={20} style={{ color: textMuted }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search investigations, notes, corrective actions..."
              className="flex-1 text-lg bg-transparent outline-none"
              style={{ color: textPrimary }}
            />
            <div className="flex items-center gap-2">
              {loading && (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              )}
              <kbd className="px-2 py-0.5 text-xs rounded border font-mono"
                style={{ borderColor: isDark ? '#252a3a' : '#d0d3db', color: textMuted }}>
                ESC
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(75vh - 70px)' }}>
            {!query ? (
              <div className="text-center py-12 px-6">
                <Search size={32} className="mx-auto mb-3 opacity-30" style={{ color: textMuted }} />
                <div className="text-sm" style={{ color: textMuted }}>
                  Search across all investigation knowledge — root causes, notes, corrective actions
                </div>
                <div className="text-xs mt-2" style={{ color: textMuted }}>
                  Press <kbd className="px-1.5 py-0.5 rounded border font-mono text-xs" style={{ borderColor: isDark ? '#252a3a' : '#d0d3db' }}>Cmd+K</kbd> anytime to open
                </div>
              </div>
            ) : results && totalResults === 0 && !loading ? (
              <div className="text-center py-12 text-sm" style={{ color: textMuted }}>
                No results found for "{query}"
              </div>
            ) : results ? (
              <div className="p-3 space-y-4">
                {/* Investigations */}
                {results.investigations.length > 0 && (
                  <ResultGroup title="Investigations" icon={<FileText size={14} />} count={results.investigations.length}>
                    {results.investigations.map((r: KnowledgeSearchResult) => (
                      <ResultItem key={`inv-${r.investigation_id}`} onClick={() => r.investigation_id && handleResultClick(r.investigation_id)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/10 text-blue-400 font-semibold">Investigation</span>
                          <span className="font-mono text-xs" style={{ color: textPrimary }}>#{r.investigation_id}</span>
                          {r.status && <StatusBadge status={r.status} />}
                          {r.defect_code && <span className="text-xs" style={{ color: textMuted }}>{r.defect_code}</span>}
                        </div>
                        <HighlightedSnippet snippet={r.snippet} />
                      </ResultItem>
                    ))}
                  </ResultGroup>
                )}

                {/* Notes */}
                {results.notes.length > 0 && (
                  <ResultGroup title="Notes" icon={<MessageSquare size={14} />} count={results.notes.length}>
                    {results.notes.map((r: KnowledgeSearchResult) => (
                      <ResultItem key={`note-${r.note_id}`} onClick={() => r.investigation_id && handleResultClick(r.investigation_id)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/10 text-purple-400 font-semibold">Note</span>
                          <span className="font-mono text-xs" style={{ color: textPrimary }}>Inv #{r.investigation_id}</span>
                          {r.author && <span className="text-xs" style={{ color: textMuted }}>by {r.author}</span>}
                        </div>
                        <HighlightedSnippet snippet={r.snippet} />
                      </ResultItem>
                    ))}
                  </ResultGroup>
                )}

                {/* Actions */}
                {results.actions.length > 0 && (
                  <ResultGroup title="Corrective Actions" icon={<CheckCircle2 size={14} />} count={results.actions.length}>
                    {results.actions.map((r: KnowledgeSearchResult) => (
                      <ResultItem key={`action-${r.action_id}`} onClick={() => r.investigation_id && handleResultClick(r.investigation_id)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-500/10 text-emerald-400 font-semibold">Action</span>
                          <span className="font-mono text-xs" style={{ color: textPrimary }}>Inv #{r.investigation_id}</span>
                          {r.status && <StatusBadge status={r.status} />}
                          {r.verified_at && <span className="text-xs text-emerald-400">verified</span>}
                        </div>
                        <HighlightedSnippet snippet={r.snippet} />
                      </ResultItem>
                    ))}
                  </ResultGroup>
                )}

                {/* Total */}
                <div className="text-xs text-center py-2" style={{ color: textMuted }}>
                  {totalResults} result{totalResults !== 1 ? 's' : ''} found
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function ResultGroup({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count: number; children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const textMuted = isDark ? '#6b7280' : '#8b8fa3';

  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <span style={{ color: textMuted }}>{icon}</span>
        <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: textMuted }}>
          {title} ({count})
        </span>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function ResultItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const { isDark } = useTheme();
  return (
    <div onClick={onClick}
      className="rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
      style={{ background: isDark ? '#111520' : '#f8f9fb' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1f30' : '#f0f1f4'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? '#111520' : '#f8f9fb'; }}>
      {children}
    </div>
  );
}

function HighlightedSnippet({ snippet }: { snippet: string }) {
  const { isDark } = useTheme();
  const textSecondary = isDark ? '#9ca3af' : '#4b5068';

  // Replace <mark> tags with highlighted spans
  const parts = snippet.split(/(<mark>.*?<\/mark>)/g);

  return (
    <div className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
      {parts.map((part, i) => {
        if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
          const text = part.slice(6, -7);
          return (
            <span key={i} className="bg-amber-500/20 text-amber-300 px-0.5 rounded">
              {text}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
