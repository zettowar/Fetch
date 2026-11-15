import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { getReports, reviewReport } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { CHECK, FIELD, LINK, ROWS, ROW_HOVER, TRAY, segItem } from './adminStyles';

const TABS = ['pending', 'reviewed', 'dismissed', 'all'] as const;
const PAGE_SIZE = 50;

export default function AdminReportsPage() {
  const [tab, setTab] = useState<string>('pending');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [strikeReason, setStrikeReason] = useState('');
  const [applyStrike, setApplyStrike] = useState(false);
  const queryClient = useQueryClient();

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports', tab, offset],
    queryFn: () => getReports({ status: tab, offset, limit: PAGE_SIZE }),
  });
  const reports = page?.items ?? [];
  const total = page?.total ?? 0;

  // The review form is shared by whichever row is expanded — reset it on
  // every expansion change so notes typed on one report can't ride along
  // into another's review.
  const openRow = (id: string | null) => {
    setExpanded(id);
    setAdminNotes('');
    setStrikeReason('');
    setApplyStrike(false);
  };

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
      <PageHeader title="Reports" className="mb-5" />

      <div className="seg max-w-full overflow-x-auto scrollbar-none mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); openRow(null); setOffset(0); }}
            className={`capitalize ${segItem(tab === t)}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load reports." onRetry={() => refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          className="py-6"
          title={tab === 'pending' ? 'Queue is clear' : `No ${tab} reports`}
          body={tab === 'pending' ? 'All reports have been reviewed.' : undefined}
        />
      ) : (
        <Card padding="none" className={ROWS}>
          {reports.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => openRow(expanded === r.id ? null : r.id)}
                className={`w-full flex items-center gap-3 p-3 text-left ${ROW_HOVER}`}
              >
                {/* The target type is a fact, not a status: one quiet tone. */}
                <Badge className="shrink-0" variant={r.target_type === 'user' ? 'info' : 'neutral'}>
                  {r.target_type}
                </Badge>
                <span className="flex-1 text-sm font-semibold text-navy dark:text-biscuit truncate">{r.reason}</span>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0"><TimeAgo value={r.created_at} /></span>
              </button>

              {expanded === r.id && (
                <div className={`px-4 pb-4 ${TRAY}`}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-gray-600 dark:text-gray-300">
                    <p><span className="font-bold text-navy dark:text-biscuit">Reason:</span> {r.reason}</p>
                    <p><span className="font-bold text-navy dark:text-biscuit">Reported:</span> <TimeAgo value={r.created_at} className="font-mono" /></p>
                    <p>
                      <span className="font-bold text-navy dark:text-biscuit">Reporter:</span>{' '}
                      <Link to={`/app/users/${r.reporter_id}`} className={`font-mono ${LINK}`} target="_blank">
                        {r.reporter_id.slice(0, 8)}...
                      </Link>
                    </p>
                    <p>
                      <span className="font-bold text-navy dark:text-biscuit">Target:</span>{' '}
                      {r.target_path ? (
                        <Link to={r.target_path} className={LINK} target="_blank">
                          View {r.target_type}
                        </Link>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                          {r.target_type} no longer exists
                        </span>
                      )}
                    </p>
                  </div>

                  {r.target_excerpt && (
                    <blockquote className="mt-3 border-l-[3px] border-navy/20 dark:border-white/20 pl-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                      {r.target_excerpt}
                    </blockquote>
                  )}

                  {r.admin_notes && (
                    // Staff-only triage, so it wears the same gold, dashed
                    // "internal" look as the notes box on a support ticket.
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg border-[1.5px] border-dashed border-warning-500 bg-warning-100 p-2 text-xs text-navy dark:border-warning-400/60 dark:bg-warning-500/10 dark:text-warning-100">
                      <Lock size={12} className="mt-px shrink-0" aria-hidden />
                      <span><span className="font-bold">Admin notes:</span> {r.admin_notes}</span>
                    </div>
                  )}

                  {r.status === 'pending' && (
                    <div className="flex flex-col gap-2 mt-3">
                      <textarea
                        className={`${FIELD} resize-none`}
                        rows={2}
                        placeholder="Admin notes (optional)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={applyStrike}
                          onChange={(e) => setApplyStrike(e.target.checked)}
                          className={CHECK}
                        />
                        Apply strike to content owner
                      </label>
                      {applyStrike && (
                        <input
                          className={FIELD}
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
                          loading={reviewMutation.isPending && reviewMutation.variables?.status === 'reviewed'}
                        >
                          Uphold Report
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={reviewMutation.isPending && reviewMutation.variables?.status === 'dismissed'}
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
        </Card>
      )}

      {!isError && (
        <PaginationFooter
          offset={offset}
          pageSize={PAGE_SIZE}
          rendered={reports.length}
          total={total}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
