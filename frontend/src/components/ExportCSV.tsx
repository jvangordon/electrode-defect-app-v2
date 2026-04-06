import { Download } from 'lucide-react';
import { useTheme } from '../App';

interface ExportCSVProps {
  data: any[];
  filename: string;
  label?: string;
}

export default function ExportCSV({ data, filename, label = 'Export CSV' }: ExportCSVProps) {
  const { isDark } = useTheme();

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data || data.length === 0}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        color: isDark ? '#9ca3af' : '#6b7280',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        border: `1px solid ${isDark ? '#252a3a' : '#e2e5eb'}`,
      }}
      title={`Download ${data?.length || 0} rows as CSV`}
    >
      <Download size={13} />
      {label}
    </button>
  );
}
