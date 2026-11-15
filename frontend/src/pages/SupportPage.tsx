import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createTicket, getFAQ, getMyTickets } from '../api/support';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import { ListSkeleton } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';
import Linkify from '../components/Linkify';
import TicketStatusBadge from '../components/TicketStatusBadge';

export default function SupportPage() {
  useDocumentTitle('Help & support · Fetchpawz');

  return (
    <div className="pb-8">
      <PageHeader
        title="Help & support"
        subtitle="Answers to the common questions — and a way to reach a human."
        back
        className="px-4 pt-4 mb-5"
      />
      <div className="px-4 flex flex-col gap-6">
        <FAQSection />
        <ContactSection />
        <MyTicketsSection />
      </div>
    </div>
  );
}

function FAQSection() {
  const { data: faq = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['faq'],
    queryFn: () => getFAQ(),
  });

  // Preserve the admin's sort_order inside each category.
  const byCategory = faq.reduce<Record<string, typeof faq>>((acc, entry) => {
    (acc[entry.category] ||= []).push(entry);
    return acc;
  }, {});

  return (
    <section>
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">
        Frequently asked
      </h2>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState message="Couldn't load the FAQ." onRetry={() => refetch()} />
      ) : faq.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No articles yet — send us a message below and we&rsquo;ll help
          directly.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byCategory).map(([category, entries]) => (
            <div key={category}>
              <h3 className="eyebrow mb-1.5">
                {category}
              </h3>
              <div className="flex flex-col gap-1.5">
                {entries.map((e) => (
                  <details
                    key={e.id}
                    className="surface group px-3.5 py-3"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-navy dark:text-biscuit">
                      {e.question}
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className="flex-shrink-0 text-navy/50 dark:text-white/40 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <div className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      <Linkify>{e.answer}</Linkify>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ContactSection() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createTicket({
        subject: subject.trim(),
        body: body.trim(),
        // Tells support which screen the person came from without asking them.
        source_screen: 'support',
      }),
    onSuccess: (ticket) => {
      toast.success(`Sent — your reference is ${ticket.ticket_number}`);
      setSubject('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't send that message")),
  });

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <section>
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">
        Still stuck? Message us
      </h2>
      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !mutation.isPending) mutation.mutate();
          }}
        >
          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ticket-body" className="field-label">
              What&rsquo;s happening?
            </label>
            <textarea
              id="ticket-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
              required
              placeholder="The more detail the better — what you expected, and what happened instead."
              className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400"
            />
          </div>
          <Button type="submit" disabled={!canSubmit} loading={mutation.isPending}>
            Send message
          </Button>
        </form>
      </Card>
    </section>
  );
}

function MyTicketsSection() {
  const { data: tickets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: getMyTickets,
  });

  return (
    <section>
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">Your messages</h2>

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <ErrorState message="Couldn't load your messages." onRetry={() => refetch()} />
      ) : tickets.length === 0 ? (
        <EmptyState
          illustration="sleeping"
          title="Nothing yet"
          body="Messages you send us show up here, along with our replies."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Card as={Link} to={`/app/support/tickets/${t.id}`} interactive>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit truncate">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{t.ticket_number}</span>
                      {' · '}
                      <TimeAgo value={t.last_message_at ?? t.created_at} />
                      {t.reply_count > 0 && ` · ${t.reply_count} ${t.reply_count === 1 ? 'reply' : 'replies'}`}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {t.unread_count > 0 && (
                      <span className="rounded-full border-[1.5px] border-navy bg-brand-500 px-1.5 py-0.5 text-2xs font-extrabold leading-none text-navy">
                        {t.unread_count} new
                      </span>
                    )}
                    <TicketStatusBadge status={t.status} />
                    <ChevronRight
                      size={16}
                      aria-hidden
                      className="text-navy/40 dark:text-white/30"
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 whitespace-pre-wrap">
                  {t.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
