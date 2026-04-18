import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAdminLostReports,
  closeLostReport,
  type AdminLostReport,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

const KIND_LABELS: Record<string, string> = {
  missing: '🔴 Missing',
  found: '🟢 Found',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

export default function AdminLostReportsPage() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-lost-reports', statusFilter, offset],
    queryFn: () => getAdminLostReports({ status: statusFilter, offset, limit: PAGE_SIZE }),
    staleTime: 2 * 60 * 1000,
  });
  const reports = page?.items ?? [];
  const total = page?.total ?? 0;

  const closeMutation = useMutation({
    mutationFn: closeLostReport,
    onSuccess: () => {
      toast.success('Report closed');
      queryClient.invalidateQueries({ queryKey: ['admin-lost-reports'] });
    },
    onError: () => toast.error('Failed to close report'),
  });

  const { missingCount, foundCount } = useMemo(() => ({
    missingCount: reports.filter((r: AdminLostReport) => r.kind === 'missing').length,
    foundCount: reports.filter((r: AdminLostReport) => r.kind === 'found').length,
  }), [reports]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Lost &amp; Found Reports</h1>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reports.length > 0 && (
        <div className="flex gap-3 mb-3 text-xs text-gray-500">
          <span>{total} total</span>
          {missingCount > 0 && <span>🔴 {missingCount} missing (page)</span>}
          {foundCount > 0 && <span>🟢 {foundCount} found (page)</span>}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No reports with status "{statusFilter}".</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {reports.map((report: AdminLostReport) => (
            <div key={report.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {KIND_LABELS[report.kind] ?? report.kind}
                      {report.dog_name && (
                        <span className="ml-1 text-gray-700">— {report.dog_name}</span>
                      )}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[report.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {report.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {report.description}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 flex-wrap">
                    <span>
                      Reporter:{' '}
                      <Link
                        to={`/users/${report.reporter_id}`}
                        target="_blank"
                        className="text-brand-500 hover:underline"
                      >
                        {report.reporter_name ?? 'Unknown'}
                      </Link>
                    </span>
                    {report.dog_id && (
                      <span>
                        Dog:{' '}
                        <Link
                          to={`/dogs/${report.dog_id}`}
                          target="_blank"
                          className="text-brand-500 hover:underline"
                        >
                          {report.dog_name ?? report.dog_id.slice(0, 8)}
                        </Link>
                      </span>
                    )}
                    <span className="ml-auto"><TimeAgo value={report.created_at} /></span>
                  </div>
                </div>

                {report.status === 'open' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={closeMutation.isPending}
                    onClick={() => {
                      if (confirm('Close this lost report?')) {
                        closeMutation.mutate(report.id);
                      }
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationFooter
        offset={offset}
        pageSize={PAGE_SIZE}
        rendered={reports.length}
        total={total}
        onChange={setOffset}
      />
    </div>
  );
}
