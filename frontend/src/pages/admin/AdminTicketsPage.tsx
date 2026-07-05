import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTickets, updateTicket } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';

const TABS = ['open', 'in_progress', 'resolved', 'closed', 'all'] as const;

const STATUS_VARIANTS: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export default function AdminTicketsPage() {
  const [tab, setTab] = useState<string>('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets', tab],
    queryFn: () => getTickets(tab),
  });

  // Shared notes field — reset whenever a different ticket is expanded so
  // notes typed on one ticket can't be submitted with another.
  const openRow = (id: string | null) => {
    setExpanded(id);
    setAdminNotes('');
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateTicket(id, { status, admin_notes: adminNotes || undefined }),
    onSuccess: () => {
      toast.success('Ticket updated');
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setAdminNotes('');
    },
    onError: () => toast.error('Failed'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>

      <div className="flex gap-1 mb-4 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); openRow(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : tickets.length === 0 ? (
        <EmptyState
          className="py-6"
          title={tab === 'open' ? 'No open tickets. Great job!' : `No ${tab.replace('_', ' ')} tickets`}
        />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {tickets.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => openRow(expanded === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
              >
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{t.ticket_number}</span>
                <span className="flex-1 text-sm truncate">{t.subject}</span>
                <Badge className="shrink-0" variant={STATUS_VARIANTS[t.status] ?? 'neutral'}>
                  {t.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0"><TimeAgo value={t.created_at} /></span>
              </button>

              {expanded === t.id && (
                <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                    {t.body}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {t.source_screen && <span>Screen: {t.source_screen}</span>}
                    <Link to={`/app/users/${t.user_id}`} className="text-brand-500 hover:underline" target="_blank">
                      View user
                    </Link>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>

                  {t.status !== 'closed' && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm resize-none"
                        rows={2}
                        placeholder="Admin notes (optional)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        {t.status === 'open' && (
                          <Button size="sm" variant="secondary" loading={updateMutation.isPending && updateMutation.variables?.status === 'in_progress'} onClick={() => updateMutation.mutate({ id: t.id, status: 'in_progress' })}>
                            Start Working
                          </Button>
                        )}
                        {t.status !== 'resolved' && (
                          <Button size="sm" loading={updateMutation.isPending && updateMutation.variables?.status === 'resolved'} onClick={() => updateMutation.mutate({ id: t.id, status: 'resolved' })}>
                            Resolve
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" loading={updateMutation.isPending && updateMutation.variables?.status === 'closed'} onClick={() => updateMutation.mutate({ id: t.id, status: 'closed' })}>
                          Close
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
    </div>
  );
}
