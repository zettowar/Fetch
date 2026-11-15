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
import ErrorState from '../../components/ui/ErrorState';
import SearchInput from '../../components/ui/SearchInput';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton, Spinner } from '../../components/ui/Skeleton';
import { CHECK, FIELD, LINK, ROWS, ROW_HOVER, TRAY, segItem } from './adminStyles';

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
  // "Needs a reply" is the queue, so it is where the page opens. It is its
  // own view, not a refinement of a status tab: the first staff answer moves a
  // ticket to in_progress, so a reporter who then writes back is awaiting a
  // reply under a status the default "open" tab never showed. ANDing the two
  // made that person invisible — the page said nothing was waiting.
  const [awaitingOnly, setAwaitingOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-tickets', tab, searchTerm, awaitingOnly, offset],
    queryFn: () =>
      searchTickets({
        status: awaitingOnly ? 'all' : tab,
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
      <PageHeader title="Support Tickets" className="mb-5" />

      <form
        onSubmit={(e) => { e.preventDefault(); setSearchTerm(query); setOffset(0); setExpanded(null); }}
        className="flex gap-2 mb-4"
      >
        <SearchInput className="flex-1" placeholder="Search subject, body, or ticket #..." value={query} onChange={setQuery} />
        <Button type="submit" size="sm" variant="secondary">Search</Button>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="seg max-w-full overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t}
              // Picking a status leaves the "Needs a reply" view.
              onClick={() => { setTab(t); setAwaitingOnly(false); setOffset(0); setExpanded(null); }}
              aria-pressed={!awaitingOnly && tab === t}
              className={`capitalize ${segItem(!awaitingOnly && tab === t)}`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
        {/* The queue that actually matters: everything nobody has answered, or
            that the reporter has come back on. Status alone hides both. */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-bold text-navy dark:text-biscuit whitespace-nowrap">
          <input
            type="checkbox"
            checked={awaitingOnly}
            onChange={(e) => { setAwaitingOnly(e.target.checked); setOffset(0); setExpanded(null); }}
            className={CHECK}
          />
          Needs a reply
        </label>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load tickets." onRetry={() => refetch()} />
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
        <Card padding="none" className={ROWS}>
          {tickets.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className={`w-full flex items-center gap-3 p-3 text-left ${ROW_HOVER}`}
              >
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0">{t.ticket_number}</span>
                <span className="flex-1 text-sm font-semibold text-navy dark:text-biscuit truncate">{t.subject}</span>
                {t.reply_count > 0 && (
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {t.reply_count} msg
                  </span>
                )}
                {t.awaiting_staff && (
                  <Badge className="shrink-0" variant="warning">needs reply</Badge>
                )}
                <Badge className="shrink-0" variant={STATUS_VARIANTS[t.status] ?? 'neutral'}>
                  {t.status.replace('_', ' ')}
                </Badge>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  <TimeAgo value={t.last_message_at ?? t.created_at} />
                </span>
              </button>

              {expanded === t.id && <TicketDetail ticketId={t.id} />}
            </div>
          ))}
        </Card>
      )}

      {!isError && (
        <PaginationFooter offset={offset} pageSize={PAGE_SIZE} rendered={tickets.length} total={total} onChange={setOffset} />
      )}
    </div>
  );
}

function TicketDetail({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState<string | null>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
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

  // A failed load used to fall through to `!ticket` and spin forever.
  if (!isLoading && isError) {
    return (
      <div className={TRAY}>
        <ErrorState message="Couldn't load this ticket." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !ticket) {
    return (
      <div className={`px-4 py-6 flex justify-center ${TRAY}`}>
        <Spinner />
      </div>
    );
  }

  const noteValue = notes ?? ticket.admin_notes ?? '';
  const canReply = reply.trim().length > 0 && !replyMutation.isPending;

  return (
    <div className={`px-4 pb-4 ${TRAY}`}>
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

      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
        {ticket.source_screen && <span>Screen: <span className="font-mono">{ticket.source_screen}</span></span>}
        <Link to={`/app/users/${ticket.user_id}`} className={LINK} target="_blank">
          View user
        </Link>
        {ticket.reporter_email && <span>{ticket.reporter_email}</span>}
        <span className="font-mono">{new Date(ticket.created_at).toLocaleString()}</span>
      </div>

      {ticket.status === 'closed' ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          This ticket is closed. The reporter can no longer reply to it.
        </p>
      ) : (
        <>
          {/* Reply — goes to the reporter. Styled to look like sending mail:
              a solid white panel with a Ball Orange line and the send icon. */}
          <div className="mt-4 rounded-2xl border-2 border-brand-500 bg-white p-3 dark:border-brand-400/70 dark:bg-night-surface">
            <label
              htmlFor={`reply-${ticketId}`}
              className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-[0.1em] text-brand-700 dark:text-brand-300"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-navy" aria-hidden>
                <Send size={11} strokeWidth={2.5} />
              </span>
              Reply to the reporter
            </label>
            <p className="mt-1 text-2xs text-gray-600 dark:text-gray-300">
              They see this in the app and by email
              {ticket.reporter_email ? ` (${ticket.reporter_email})` : ''}.
            </p>
            <textarea
              id={`reply-${ticketId}`}
              className={`mt-2 w-full ${FIELD}`}
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
              The gold, dashed "internal" framing (a sticky note, not a letter)
              is the only thing standing between an operator and pasting a
              triage note into a customer's inbox. Its focus ring is gold too,
              never the reply box's orange. */}
          <div className="mt-3 rounded-2xl border-2 border-dashed border-warning-500 bg-warning-100 p-3 dark:border-warning-400/60 dark:bg-warning-500/10">
            <label
              htmlFor={`notes-${ticketId}`}
              className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-[0.1em] text-warning-900 dark:text-warning-200"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy text-warning-500 dark:bg-warning-500 dark:text-navy" aria-hidden>
                <Lock size={11} strokeWidth={2.5} />
              </span>
              Internal note — never shown to the reporter
            </label>
            <textarea
              id={`notes-${ticketId}`}
              className="mt-2 w-full rounded-lg border-[1.5px] border-dashed border-warning-600/60 bg-warning-50 px-3 py-2 text-sm font-medium text-navy placeholder:text-warning-800/60 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out focus:border-warning-600 focus:ring-4 focus:ring-warning-500/30 dark:border-warning-400/40 dark:bg-night dark:text-biscuit dark:placeholder:text-warning-200/50 dark:focus:border-warning-400"
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
      className={`rounded-2xl border p-3 text-sm whitespace-pre-wrap ${
        fromStaff
          ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10 ml-6'
          : 'border-gray-200 bg-white dark:border-white/10 dark:bg-night-surface mr-6'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-2xs text-gray-500 dark:text-gray-400">
        <span className="font-extrabold uppercase tracking-[0.1em]">{who}</span>
        <TimeAgo value={at} className="font-mono" />
      </div>
      <p className="text-navy dark:text-biscuit">{body}</p>
    </div>
  );
}
