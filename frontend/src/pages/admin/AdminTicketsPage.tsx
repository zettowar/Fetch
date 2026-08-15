import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Send } from 'lucide-react';
import {
  getTicketThread,
  replyToTicket,
  searchTickets,
  updateTicket,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton, Spinner } from '../../components/ui/Skeleton';

const PAGE_SIZE = 50;

const TABS = ['open', 'in_progress', 'resolved', 'closed', 'all'] as const;

const STATUS_VARIANTS: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',
};

export default function AdminTicketsPage() {
  const [tab, setTab] = useState<string>('open');
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-tickets', tab, searchTerm, awaitingOnly, offset],
    queryFn: () =>
      searchTickets({
        status: tab,
        q: searchTerm,
        awaiting: awaitingOnly,
        offset,
        limit: PAGE_SIZE,
      }),
  });
  const tickets = page?.items ?? [];
  const total = page?.total ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); setSearchTerm(query); setOffset(0); setExpanded(null); }}
        className="flex gap-2 mb-4"
      >
        <SearchInput className="flex-1" placeholder="Search subject, body, or ticket #..." value={query} onChange={setQuery} />
        <Button type="submit" size="sm">Search</Button>
      </form>

      <div className="flex flex-wrap items-center gap-1 mb-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setOffset(0); setExpanded(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        {/* The queue that actually matters: everything nobody has answered, or
            that the reporter has come back on. Status alone hides both. */}
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
          <input
            type="checkbox"
            checked={awaitingOnly}
            onChange={(e) => { setAwaitingOnly(e.target.checked); setOffset(0); setExpanded(null); }}
            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          Needs a reply
        </label>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : tickets.length === 0 ? (
        <EmptyState
          className="py-6"
          title={
            awaitingOnly
              ? 'Nothing is waiting on a reply.'
              : tab === 'open'
                ? 'No open tickets. Great job!'
                : `No ${tab.replace('_', ' ')} tickets`
          }
        />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {tickets.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
              >
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{t.ticket_number}</span>
                <span className="flex-1 text-sm truncate">{t.subject}</span>
                {t.reply_count > 0 && (
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {t.reply_count} msg
                  </span>
                )}
                {t.awaiting_staff && (
                  <Badge className="shrink-0" variant="warning">needs reply</Badge>
                )}
                <Badge className="shrink-0" variant={STATUS_VARIANTS[t.status] ?? 'neutral'}>
                  {t.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  <TimeAgo value={t.last_message_at ?? t.created_at} />
                </span>
              </button>

              {expanded === t.id && <TicketDetail ticketId={t.id} />}
            </div>
          ))}
        </Card>
      )}

      <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={tickets.length} total={total} onChange={setOffset} />
    </div>
  );
}

function TicketDetail({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState<string | null>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['admin-ticket', ticketId],
    queryFn: () => getTicketThread(ticketId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-ticket', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const replyMutation = useMutation({
    mutationFn: (status?: string) => replyToTicket(ticketId, { body: reply.trim(), status }),
    onSuccess: () => {
      toast.success('Reply sent to the reporter');
      setReply('');
      invalidate();
    },
    onError: () => toast.error('Failed to send the reply'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      updateTicket(ticketId, { status, admin_notes: notes ?? undefined }),
    onSuccess: () => {
      toast.success('Ticket updated');
      invalidate();
    },
    onError: () => toast.error('Failed'),
  });

  if (isLoading || !ticket) {
    return (
      <div className="px-4 py-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const noteValue = notes ?? ticket.admin_notes ?? '';
  const canReply = reply.trim().length > 0 && !replyMutation.isPending;

  return (
    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
      {/* Conversation */}
      <div className="mt-3 flex flex-col gap-2">
        <Message role="user" body={ticket.body} at={ticket.created_at} who="Reporter" />
        {ticket.messages.map((m) => (
          <Message
            key={m.id}
            role={m.author_role}
            body={m.body}
            at={m.created_at}
            who={m.author_role === 'staff' ? (m.author_name ?? 'Support') : 'Reporter'}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
        {ticket.source_screen && <span>Screen: {ticket.source_screen}</span>}
        <Link to={`/app/users/${ticket.user_id}`} className="text-brand-500 hover:underline" target="_blank">
          View user
        </Link>
        {ticket.reporter_email && <span>{ticket.reporter_email}</span>}
        <span>{new Date(ticket.created_at).toLocaleString()}</span>
      </div>

      {ticket.status === 'closed' ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          This ticket is closed. The reporter can no longer reply to it.
        </p>
      ) : (
        <>
          {/* Reply — goes to the reporter. Styled to look like sending mail. */}
          <div className="mt-4 rounded-lg border border-brand-200 dark:border-brand-500/40 bg-white dark:bg-gray-900 p-3">
            <label
              htmlFor={`reply-${ticketId}`}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300"
            >
              <Send size={13} aria-hidden />
              Reply to the reporter
            </label>
            <p className="mt-0.5 text-2xs text-gray-500 dark:text-gray-400">
              They see this in the app and by email
              {ticket.reporter_email ? ` (${ticket.reporter_email})` : ''}.
            </p>
            <textarea
              id={`reply-${ticketId}`}
              className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-950 px-3 py-2 text-sm"
              rows={3}
              placeholder="Write the answer they'll read..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!canReply}
                loading={replyMutation.isPending && replyMutation.variables === undefined}
                onClick={() => replyMutation.mutate(undefined)}
              >
                Send reply
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canReply}
                loading={replyMutation.isPending && replyMutation.variables === 'resolved'}
                onClick={() => replyMutation.mutate('resolved')}
              >
                Send &amp; resolve
              </Button>
            </div>
          </div>

          {/* Internal note — deliberately styled nothing like the reply box.
              The amber "internal" framing is the only thing standing between an
              operator and pasting a triage note into a customer's inbox. */}
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
            <label
              htmlFor={`notes-${ticketId}`}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
            >
              <Lock size={13} aria-hidden />
              Internal note — never shown to the reporter
            </label>
            <textarea
              id={`notes-${ticketId}`}
              className="mt-2 w-full rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Context for whoever picks this up next..."
              value={noteValue}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {ticket.status === 'open' && (
                <Button size="sm" variant="secondary" loading={statusMutation.isPending && statusMutation.variables === 'in_progress'} onClick={() => statusMutation.mutate('in_progress')}>
                  Start working
                </Button>
              )}
              {ticket.status !== 'resolved' && (
                <Button size="sm" variant="secondary" loading={statusMutation.isPending && statusMutation.variables === 'resolved'} onClick={() => statusMutation.mutate('resolved')}>
                  Resolve without replying
                </Button>
              )}
              <Button size="sm" variant="ghost" loading={statusMutation.isPending && statusMutation.variables === 'closed'} onClick={() => statusMutation.mutate('closed')}>
                Close
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Message({
  role,
  body,
  at,
  who,
}: {
  role: string;
  body: string;
  at: string;
  who: string;
}) {
  const fromStaff = role === 'staff';
  return (
    <div
      className={`rounded-lg border p-3 text-sm whitespace-pre-wrap ${
        fromStaff
          ? 'border-brand-100 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10 ml-6'
          : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 mr-6'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-2xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span className="font-semibold">{who}</span>
        <TimeAgo value={at} />
      </div>
      <p className="text-gray-700 dark:text-gray-300">{body}</p>
    </div>
  );
}
