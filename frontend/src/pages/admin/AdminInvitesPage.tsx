import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvites, generateInvites, getWaitlist, inviteWaitlistEntry, deleteWaitlistEntry } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function AdminInvitesPage() {
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('unused');
  const queryClient = useQueryClient();

  const { data: allInvites = [], isLoading } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: getInvites,
  });

  const genMutation = useMutation({
    mutationFn: () => generateInvites(count),
    onSuccess: (data) => {
      toast.success(`Generated ${data.length} codes`);
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed'),
  });

  const invites = filter === 'all' ? allInvites :
    filter === 'unused' ? allInvites.filter((i) => !i.is_used) :
    allInvites.filter((i) => i.is_used);

  const unusedCount = allInvites.filter((i) => !i.is_used).length;
  const usedCount = allInvites.filter((i) => i.is_used).length;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied: ${code}`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const copyAllUnused = async () => {
    const codes = allInvites.filter((i) => !i.is_used).map((i) => i.code).join('\n');
    try {
      await navigator.clipboard.writeText(codes);
      toast.success(`Copied ${unusedCount} codes`);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Invite Codes</h1>

      {/* Generate section */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Generate</label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-1 text-sm"
          />
          <Button size="sm" onClick={() => genMutation.mutate()} loading={genMutation.isPending}>
            Generate
          </Button>
          {unusedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={copyAllUnused}>
              Copy all unused
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          {unusedCount} unused / {usedCount} used / {allInvites.length} total
        </p>
      </Card>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {(['unused', 'used', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : invites.length === 0 ? (
        <EmptyState className="py-6" title={`No ${filter} invite codes`} />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-3">
              <button
                onClick={() => copyCode(inv.code)}
                className="font-mono text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600 transition-colors cursor-pointer"
                title="Click to copy"
              >
                {inv.code}
              </button>
              <span className="flex-1" />
              {inv.is_used ? (
                <Badge variant="neutral">Used</Badge>
              ) : (
                <Badge variant="success">Available</Badge>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500"><TimeAgo value={inv.created_at} /></span>
            </div>
          ))}
        </Card>
      )}

      <WaitlistSection />
    </div>
  );
}

/** Invite requests from the marketing site — the other half of this funnel. */
function WaitlistSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: getWaitlist,
  });
  const entries = data?.items ?? [];

  const inviteMutation = useMutation({
    mutationFn: inviteWaitlistEntry,
    onSuccess: async (res) => {
      try {
        await navigator.clipboard.writeText(res.signup_url);
      } catch {
        /* clipboard may be blocked; the invite still went out */
      }
      toast.success(res.email_sent ? 'Invite emailed — link copied' : 'Invite created — link copied');
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
    },
    onError: () => toast.error('Failed to send invite'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWaitlistEntry,
    onSuccess: () => {
      toast.success('Removed from waitlist');
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
    },
    onError: () => toast.error('Failed'),
  });

  const copyAllEmails = async () => {
    try {
      await navigator.clipboard.writeText(entries.map((e) => e.email).join('\n'));
      toast.success(`Copied ${entries.length} emails`);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold">Waitlist</h2>
        {data && (
          <span className="text-sm text-gray-400 dark:text-gray-500">{data.total} waiting</span>
        )}
        <span className="flex-1" />
        {entries.length > 0 && (
          <Button size="sm" variant="ghost" onClick={copyAllEmails}>
            Copy all emails
          </Button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : entries.length === 0 ? (
        <EmptyState className="py-6" title="No waitlist signups yet" />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 p-3">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{entry.email}</span>
              {entry.source && <Badge variant="neutral">{entry.source}</Badge>}
              {entry.invited_at && (
                <Badge variant="success" title={`Invited ${entry.invite_code ?? ''}`}>
                  Invited
                </Badge>
              )}
              <span className="flex-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500"><TimeAgo value={entry.created_at} /></span>
              <Button
                size="sm"
                variant={entry.invited_at ? 'ghost' : 'secondary'}
                onClick={() => inviteMutation.mutate(entry.id)}
                loading={inviteMutation.isPending && inviteMutation.variables === entry.id}
              >
                {entry.invited_at ? 'Re-send' : 'Invite'}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => deleteMutation.mutate(entry.id)}
                loading={deleteMutation.isPending && deleteMutation.variables === entry.id}
              >
                Remove
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
