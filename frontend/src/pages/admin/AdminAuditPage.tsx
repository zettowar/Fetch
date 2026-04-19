import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLog, type AuditLogEntry } from '../../api/admin';
import { Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';

const ACTION_COLORS: Record<string, string> = {
  'user.suspend': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'user.reinstate': 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  'user.promote': 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  'user.demote': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'report.review': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'ticket.update': 'bg-sky-100 text-sky-700',
  'dog.deactivate': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  'dog.reactivate': 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  'lost_report.close': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  'faq.create': 'bg-teal-100 text-teal-700',
  'faq.update': 'bg-teal-100 text-teal-700',
  'faq.delete': 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const KNOWN_ACTIONS = Object.keys(ACTION_COLORS);

function actionColor(action: string) {
  return ACTION_COLORS[action] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
}

function MetadataView({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta || Object.keys(meta).length === 0) return null;
  return (
    <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono">
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

  const { data: entries = [], isLoading, refetch } = useQuery({
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
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-center py-12">No audit entries found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y">
          {entries.map((entry: AuditLogEntry) => (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded shrink-0 mt-0.5 ${actionColor(entry.action)}`}>
                  {entry.action}
                </span>
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
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      by <span className="font-mono">{entry.actor_id.slice(0, 8)}…</span>
                    </p>
                  )}
                  <MetadataView meta={entry.metadata_} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
