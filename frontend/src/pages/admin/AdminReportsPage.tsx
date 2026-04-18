import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getReports, reviewReport } from '../../api/admin';
import Button from '../../components/ui/Button';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';

const TABS = ['pending', 'reviewed', 'dismissed', 'all'] as const;
const PAGE_SIZE = 50;

function targetLink(type: string, id: string): string {
  if (type === 'dog') return `/dogs/${id}`;
  if (type === 'photo') return `/dogs/${id}`;
  if (type === 'user') return `/users/${id}`;
  return '#';
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<string>('pending');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [strikeReason, setStrikeReason] = useState('');
  const [applyStrike, setApplyStrike] = useState(false);
  const queryClient = useQueryClient();

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-reports', tab, offset],
    queryFn: () => getReports({ status: tab, offset, limit: PAGE_SIZE }),
  });
  const reports = page?.items ?? [];
  const total = page?.total ?? 0;

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      reviewReport(id, {
        status,
        admin_notes: adminNotes || undefined,
        apply_strike: applyStrike,
        strike_reason: strikeReason || undefined,
      }),
    onSuccess: () => {
      toast.success('Report reviewed');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setExpanded(null);
      setApplyStrike(false);
      setStrikeReason('');
      setAdminNotes('');
    },
    onError: () => toast.error('Failed to review'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports</h1>

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpanded(null); setOffset(0); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">{tab === 'pending' ? 'Queue is clear' : `No ${tab} reports`}</p>
          {tab === 'pending' && <p className="text-sm">All reports have been reviewed.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {reports.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  r.target_type === 'user' ? 'bg-red-100 text-red-700' :
                  r.target_type === 'photo' ? 'bg-blue-100 text-blue-700' :
                  r.target_type === 'dog' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{r.target_type}</span>
                <span className="flex-1 text-sm truncate">{r.reason}</span>
                <span className="text-xs text-gray-400 shrink-0"><TimeAgo value={r.created_at} /></span>
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                    <p><span className="font-medium">Reason:</span> {r.reason}</p>
                    <p><span className="font-medium">Reported:</span> <TimeAgo value={r.created_at} /></p>
                    <p>
                      <span className="font-medium">Reporter:</span>{' '}
                      <Link to={`/users/${r.reporter_id}`} className="text-brand-500 hover:underline" target="_blank">
                        {r.reporter_id.slice(0, 8)}...
                      </Link>
                    </p>
                    <p>
                      <span className="font-medium">Target:</span>{' '}
                      <Link to={targetLink(r.target_type, r.target_id)} className="text-brand-500 hover:underline" target="_blank">
                        View {r.target_type}
                      </Link>
                    </p>
                  </div>

                  {r.admin_notes && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">
                      <span className="font-medium">Admin notes:</span> {r.admin_notes}
                    </div>
                  )}

                  {r.status === 'pending' && (
                    <div className="flex flex-col gap-2 mt-3">
                      <textarea
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                        rows={2}
                        placeholder="Admin notes (optional)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={applyStrike}
                          onChange={(e) => setApplyStrike(e.target.checked)}
                          className="rounded"
                        />
                        Apply strike to content owner
                      </label>
                      {applyStrike && (
                        <input
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                          placeholder="Strike reason..."
                          value={strikeReason}
                          onChange={(e) => setStrikeReason(e.target.value)}
                        />
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => reviewMutation.mutate({ id: r.id, status: 'reviewed' })}
                          loading={reviewMutation.isPending}
                        >
                          Uphold Report
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => reviewMutation.mutate({ id: r.id, status: 'dismissed' })}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
