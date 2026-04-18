import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTickets, updateTicket } from '../../api/admin';
import Button from '../../components/ui/Button';
import TimeAgo from '../../components/TimeAgo';

const TABS = ['open', 'in_progress', 'resolved', 'closed', 'all'] as const;

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
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

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setExpanded(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {tab === 'open' ? 'No open tickets. Great job!' : `No ${tab.replace('_', ' ')} tickets.`}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {tickets.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
              >
                <span className="text-xs font-mono text-gray-400 shrink-0">{t.ticket_number}</span>
                <span className="flex-1 text-sm truncate">{t.subject}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600'}`}>
                  {t.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-400 shrink-0"><TimeAgo value={t.created_at} /></span>
              </button>

              {expanded === t.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-100">
                    {t.body}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {t.source_screen && <span>Screen: {t.source_screen}</span>}
                    <Link to={`/users/${t.user_id}`} className="text-brand-500 hover:underline" target="_blank">
                      View user
                    </Link>
                    <span>{new Date(t.created_at).toLocaleString()}</span>
                  </div>

                  {t.status !== 'closed' && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
                        rows={2}
                        placeholder="Admin notes (optional)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        {t.status === 'open' && (
                          <Button size="sm" variant="secondary" onClick={() => updateMutation.mutate({ id: t.id, status: 'in_progress' })}>
                            Start Working
                          </Button>
                        )}
                        {t.status !== 'resolved' && (
                          <Button size="sm" onClick={() => updateMutation.mutate({ id: t.id, status: 'resolved' })}>
                            Resolve
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: t.id, status: 'closed' })}>
                          Close
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
    </div>
  );
}
