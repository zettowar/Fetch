import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getAnnouncements, createAnnouncement } from '../../api/admin';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';

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

  const { data: history = [], isLoading } = useQuery({
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
      <h1 className="text-2xl font-bold mb-4">Announcements</h1>

      <Card className="mb-6">
        <h2 className="text-sm font-semibold mb-3">Compose broadcast</h2>
        <div className="space-y-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening" />
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              placeholder="Body of the announcement"
            />
          </div>
          <Input label="Link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app/news" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Audience{' '}
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm ml-1"
              >
                {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-brand-500" />
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

      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">History</h2>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : history.length === 0 ? (
        <EmptyState className="py-6" title="No announcements sent yet" />
      ) : (
        <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {history.map((a) => (
            <li key={a.id} className="p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.title}</span>
                <Badge variant="neutral" className="uppercase">{a.segment}</Badge>
                {a.send_email && <Badge variant="info">emailed</Badge>}
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                  {a.recipient_count} recipient{a.recipient_count !== 1 ? 's' : ''} · <TimeAgo value={a.created_at} />
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
