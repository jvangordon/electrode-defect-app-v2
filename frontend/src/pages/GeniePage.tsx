import { Sparkles, ExternalLink } from 'lucide-react';
import { useTheme } from '../App';

export default function GeniePage() {
  const { isDark } = useTheme();

  const iframeSrc = 'https://dbc-7816609d-d7c1.cloud.databricks.com/embed/dashboardsv3/01f12de1fe981ccb8495a61e0d2f0340?o=7474650189132115';
  const genieRoomUrl = 'https://dbc-7816609d-d7c1.cloud.databricks.com/genie/rooms/01f12de1e7b3163881fbeeba04111056?o=7474650189132115';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-10 py-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: isDark ? '#e5e7eb' : '#1a1d2b' }}>
            <Sparkles size={24} className="text-amber-400" />
            Genie Explorer
          </h1>
          <p className="text-sm mt-1" style={{ color: isDark ? '#6b7280' : '#8b8fa3' }}>
            Ask questions about your manufacturing data in natural language
          </p>
        </div>
        <a
          href={genieRoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          style={{
            color: isDark ? '#9ca3af' : '#4b5068',
            border: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
            background: isDark ? '#141824' : '#ffffff',
          }}
        >
          Open in Databricks
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="flex-1 px-10 pb-6">
        <div
          className="w-full h-full rounded-xl overflow-hidden"
          style={{ border: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}` }}
        >
          <iframe
            src={iframeSrc}
            title="Databricks Genie Explorer"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
