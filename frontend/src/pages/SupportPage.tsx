import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, LifeBuoy } from 'lucide-react';
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

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  pending: 'bg-warning-100 text-warning-800 dark:bg-warning-500/15 dark:text-warning-200',
  resolved: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export default function SupportPage() {
  useDocumentTitle('Help & support · Fetchpawz');

  return (
    <div className="pb-8">
      <PageHeader
        title="Help & support"
        subtitle="Answers to the common questions — and a way to reach a human."
        back
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
      <h2 className="text-base font-bold tracking-tight mb-2">
        Frequently asked
      </h2>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState message="Couldn't load the FAQ." onRetry={() => refetch()} />
      ) : faq.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No articles yet — send us a message below and we&rsquo;ll help
          directly.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(byCategory).map(([category, entries]) => (
            <div key={category}>
              <h3 className="text-2xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                {category}
              </h3>
              <div className="flex flex-col gap-1.5">
                {entries.map((e) => (
                  <details
                    key={e.id}
                    className="group rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                      {e.question}
                      <ChevronDown
                        size={16}
                        aria-hidden
                        className="flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180"
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
      <h2 className="text-base font-bold tracking-tight mb-2">
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
            <label
              htmlFor="ticket-body"
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
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
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
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
      <h2 className="text-base font-bold tracking-tight mb-2">Your messages</h2>

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <ErrorState message="Couldn't load your messages." onRetry={() => refetch()} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy size={28} aria-hidden />}
          title="Nothing yet"
          body="Messages you send us will show up here with their status."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      <span className="font-mono">{t.ticket_number}</span>
                      {' · '}
                      <TimeAgo value={t.created_at} />
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                      STATUS_STYLES[t.status] ?? STATUS_STYLES.closed
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap">
                  {t.body}
                </p>
                {t.admin_notes && (
                  <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-500/10 dark:text-brand-100">
                    <p className="text-2xs font-semibold uppercase tracking-wide opacity-70">
                      Reply from support
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      <Linkify>{t.admin_notes}</Linkify>
                    </p>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
