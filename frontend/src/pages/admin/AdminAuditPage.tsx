import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog, type AuditLogEntry } from '../../api/admin';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import TimeAgo from '../../components/TimeAgo';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ACTION_VARIANTS: Record<string, BadgeVariant> = {
  'user.suspend': 'danger',
  'user.reinstate': 'success',
  'user.promote': 'info',
  'user.demote': 'warning',
  'report.review': 'info',
  'ticket.update': 'info',
  'dog.deactivate': 'danger',
  'dog.reactivate': 'success',
  'lost_report.close': 'neutral',
  'faq.create': 'info',
  'faq.update': 'info',
  'faq.delete': 'danger',
};

const KNOWN_ACTIONS = Object.keys(ACTION_VARIANTS);

function actionVariant(action: string): BadgeVariant {
  return ACTION_VARIANTS[action] ?? 'neutral';
}

function MetadataView({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta || Object.keys(meta).length === 0) return null;
  return (
    <div className="mt-1 text-2xs text-gray-400 dark:text-gray-500 font-mono">
      {Object.entries(meta).map(([k, v]) => (
        <span key={k} className="mr-2">
          {k}: <span className="text-gray-600 dark:text-gray-300">{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const { data: entries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-audit', actionFilter, targetTypeFilter, limit],
    queryFn: () => getAuditLog({
      action: actionFilter || undefined,
      target_type: targetTypeFilter || undefined,
      limit,
    }),
    staleTime: 2 * 60 * 1000,
  });

  // Actions in current result set not already in the known list
  const extraActions = useMemo(
    () => [...new Set(entries.map((e: AuditLogEntry) => e.action))].filter((a) => !KNOWN_ACTIONS.includes(a)).sort(),
    [entries],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <button onClick={() => refetch()} className="text-xs text-brand-500 hover:underline">
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {KNOWN_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
          {extraActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm"
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
        >
          <option value="">All targets</option>
          <option value="user">user</option>
          <option value="dog">dog</option>
          <option value="report">report</option>
          <option value="ticket">ticket</option>
          <option value="lost_report">lost_report</option>
          <option value="faq">faq</option>
        </select>

        <select
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1.5 text-sm"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={50}>50 entries</option>
          <option value={100}>100 entries</option>
          <option value={250}>250 entries</option>
          <option value={500}>500 entries</option>
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load the audit log." onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState className="py-6" title="No audit entries found" />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry: AuditLogEntry) => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Badge className="font-mono shrink-0 mt-0.5" variant={actionVariant(entry.action)}>
                  {entry.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.target_type && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.target_type}
                        {entry.target_id && (
                          <span className="text-gray-300 dark:text-gray-600 ml-1 font-mono">
                            {entry.target_id.slice(0, 8)}…
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
                      <TimeAgo value={entry.created_at} />
                    </span>
                  </div>
                  {entry.actor_id && (
                    <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                      by <span className="font-mono">{entry.actor_id.slice(0, 8)}…</span>
                    </p>
                  )}
                  <MetadataView meta={entry.metadata_} />
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
