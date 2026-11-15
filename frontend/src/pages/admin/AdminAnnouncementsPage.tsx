import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getAnnouncements, createAnnouncement } from '../../api/admin';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import TimeAgo from '../../components/TimeAgo';
import { CHECK, FIELD, ROWS } from './adminStyles';

const SEGMENTS = [
  { value: 'all', label: 'All users' },
  { value: 'active', label: 'Active users' },
  { value: 'with_pets', label: 'Users with pets' },
  { value: 'rescues', label: 'Rescue accounts' },
  { value: 'staff', label: 'Staff only' },
];

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [segment, setSegment] = useState('all');
  const [sendEmail, setSendEmail] = useState(false);

  const { data: history = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: getAnnouncements,
  });

  const send = useMutation({
    mutationFn: () => createAnnouncement({ title, body, link: link || undefined, segment, send_email: sendEmail }),
    onSuccess: () => {
      toast.success('Announcement queued for delivery');
      setTitle(''); setBody(''); setLink(''); setSendEmail(false);
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    },
    onError: () => toast.error('Failed to send announcement'),
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div>
      <PageHeader title="Announcements" className="mb-5" />

      <Card padding="lg" className="mb-7">
        <h2 className="text-base font-extrabold text-navy dark:text-biscuit mb-3">Compose broadcast</h2>
        <div className="space-y-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-announcement-message" className="field-label">Message</label>
            <textarea
              id="admin-announcement-message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className={`w-full ${FIELD}`}
              placeholder="Body of the announcement"
            />
          </div>
          <Input label="Link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app/news" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="field-label">Audience</span>{' '}
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className={FIELD}
              >
                {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className={CHECK} />
              Also email
            </label>
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!canSend}
              loading={send.isPending}
              onClick={() => {
                if (confirm(`Send "${title}" to ${SEGMENTS.find((s) => s.value === segment)?.label}?`)) send.mutate();
              }}
            >
              Send broadcast
            </Button>
          </div>
        </div>
      </Card>

      <SectionHeader title="History" />
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState message="Couldn't load announcements." onRetry={() => refetch()} />
      ) : history.length === 0 ? (
        <EmptyState className="py-6" title="No announcements sent yet" />
      ) : (
        <Card as="ul" padding="none" className={ROWS}>
          {history.map((a) => (
            <li key={a.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-navy dark:text-biscuit">{a.title}</span>
                <Badge variant="neutral" className="uppercase">{a.segment}</Badge>
                {a.send_email && <Badge variant="info">emailed</Badge>}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {a.recipient_count} recipient{a.recipient_count !== 1 ? 's' : ''} · <TimeAgo value={a.created_at} className="font-mono" />
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{a.body}</p>
            </li>
          ))}
        </Card>
      )}
    </div>
  );
}
