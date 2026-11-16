import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvites, generateInvites, getWaitlist, inviteWaitlistEntry, deleteWaitlistEntry } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { FIELD, ROWS, ROW_HOVER, segItem } from './adminStyles';
import { apiErrorMessage } from '../../utils/apiError';

export default function AdminInvitesPage() {
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('unused');
  const queryClient = useQueryClient();

  const { data: allInvites = [], isLoading, isError, refetch } = useQuery({
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
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
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
      <PageHeader title="Invite codes" className="mb-5" />

      {/* Generate section */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <label htmlFor="admin-invites-generate-count" className="field-label shrink-0">Generate</label>
          <input
            id="admin-invites-generate-count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`${FIELD} w-20 font-mono`}
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
        {/* A failed load would read "0 unused / 0 used / 0 total"; the error
            itself is shown once, in the list below. */}
        {!isError && (
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-2">
            {unusedCount} unused / {usedCount} used / {allInvites.length} total
          </p>
        )}
      </Card>

      {/* Filter */}
      <div className="seg mb-4">
        {(['unused', 'used', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`capitalize ${segItem(filter === f)}`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load invite codes." onRetry={() => refetch()} />
      ) : invites.length === 0 ? (
        <EmptyState className="py-6" title={filter === 'all' ? 'No invite codes yet' : `No ${filter} invite codes`} />
      ) : (
        <Card padding="none" className={ROWS}>
          {invites.map((inv) => (
            <div key={inv.id} className={`flex items-center gap-3 p-3 ${ROW_HOVER}`}>
              <button
                onClick={() => copyCode(inv.code)}
                className="font-mono text-sm font-medium tracking-wide text-navy dark:text-biscuit hover:text-brand-700 dark:hover:text-brand-300 hover:underline underline-offset-2 transition-colors cursor-pointer"
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
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400"><TimeAgo value={inv.created_at} /></span>
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: getWaitlist,
  });
  const entries = data?.items ?? [];

  const inviteMutation = useMutation({
    mutationFn: inviteWaitlistEntry,
    onSuccess: async (res) => {
      // Say "link copied" only if it was: the clipboard can be blocked, and
      // the toast claimed it either way.
      let copied = true;
      try {
        await navigator.clipboard.writeText(res.signup_url);
      } catch {
        copied = false;
      }
      const what = res.email_sent ? 'Invite emailed' : 'Invite created';
      toast.success(copied ? `${what} — link copied` : what);
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
      // This minted an invite code, so the code list and its counts above
      // changed too.
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Failed to send invite')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWaitlistEntry,
    onSuccess: () => {
      toast.success('Removed from waitlist');
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, "That didn't go through. Try again.")),
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
        <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit">Waitlist</h2>
        {data && !isError && (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{data.total} waiting</span>
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
      ) : isError ? (
        <ErrorState message="Couldn't load the waitlist." onRetry={() => refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState className="py-6" title="No waitlist signups yet" />
      ) : (
        <Card padding="none" className={ROWS}>
          {entries.map((entry) => (
            <div key={entry.id} className={`flex items-center gap-3 p-3 ${ROW_HOVER}`}>
              <span className="text-sm font-semibold text-navy dark:text-biscuit truncate">{entry.email}</span>
              {entry.source && <Badge variant="neutral">{entry.source}</Badge>}
              {entry.invited_at && (
                <Badge variant="success" title={`Invited ${entry.invite_code ?? ''}`}>
                  Invited
                </Badge>
              )}
              <span className="flex-1" />
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400"><TimeAgo value={entry.created_at} /></span>
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
                onClick={() => {
                  if (confirm(`Remove ${entry.email} from the waitlist?`)) deleteMutation.mutate(entry.id);
                }}
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
