import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getTicketThread, replyToTicket } from '../api/support';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';
import Linkify from '../components/Linkify';
import TicketStatusBadge from '../components/TicketStatusBadge';

export default function TicketThreadPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicketThread(id),
    enabled: !!id,
  });

  useDocumentTitle(ticket ? `${ticket.subject} · Support` : 'Support · Fetchpawz');

  // Opening the thread clears the unread watermark server-side, so the badge in
  // the shell has to be refetched or it keeps claiming there is something new.
  useEffect(() => {
    if (ticket) {
      queryClient.invalidateQueries({ queryKey: ['ticket-unread'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    }
  }, [ticket, queryClient]);

  const mutation = useMutation({
    mutationFn: () => replyToTicket(id, reply.trim()),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't send that reply")),
  });

  if (isLoading) {
    return (
      <div className="pb-8">
        <PageHeader title="Conversation" back backFallback="/app/support" />
        <div className="px-4">
          <ListSkeleton rows={3} />
        </div>
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="pb-8">
        <PageHeader title="Conversation" back backFallback="/app/support" />
        <div className="px-4">
          <ErrorState
            message="We couldn't load this conversation."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';
  const canSend = reply.trim().length > 0 && !mutation.isPending;

  return (
    <div className="pb-8">
      <PageHeader title={ticket.subject} back backFallback="/app/support" />

      <div className="px-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="font-mono">{ticket.ticket_number}</span>
          <TicketStatusBadge status={ticket.status} />
        </div>

        <ol className="flex flex-col gap-3">
          {/* The opening message lives on the ticket itself rather than as a
              row in the messages table, so it is rendered explicitly here. */}
          <Bubble
            side="user"
            body={ticket.body}
            at={ticket.created_at}
            label="You"
          />
          {ticket.messages.map((m) => (
            <Bubble
              key={m.id}
              side={m.author_role === 'staff' ? 'staff' : 'user'}
              body={m.body}
              at={m.created_at}
              label={m.author_role === 'staff' ? 'Fetchpawz support' : 'You'}
            />
          ))}
        </ol>
        <div ref={endRef} />

        {isClosed ? (
          <Card>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This conversation is closed. If you still need help,{' '}
              <Link to="/app/support" className="text-brand-500 font-medium hover:underline">
                start a new message
              </Link>
              .
            </p>
          </Card>
        ) : (
          <Card>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSend) mutation.mutate();
              }}
            >
              <label htmlFor="ticket-reply" className="text-sm font-medium">
                Reply
              </label>
              <textarea
                id="ticket-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={
                  ticket.status === 'resolved'
                    ? "If this isn't sorted, tell us here and we'll pick it back up."
                    : 'Add anything else that might help.'
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              {ticket.status === 'resolved' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Replying reopens this conversation.
                </p>
              )}
              <Button type="submit" disabled={!canSend} loading={mutation.isPending}>
                Send reply
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function Bubble({
  side,
  body,
  at,
  label,
}: {
  side: 'user' | 'staff';
  body: string;
  at: string;
  label: string;
}) {
  const fromStaff = side === 'staff';
  return (
    <li className={`flex flex-col ${fromStaff ? 'items-start' : 'items-end'}`}>
      <span className="mb-1 px-1 text-2xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          fromStaff
            ? 'rounded-tl-sm bg-white border border-gray-100 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'
            : 'rounded-tr-sm bg-brand-500 text-white'
        }`}
      >
        <Linkify>{body}</Linkify>
      </div>
      <span className="mt-1 px-1 text-2xs text-gray-400 dark:text-gray-500">
        <TimeAgo value={at} />
      </span>
    </li>
  );
}
