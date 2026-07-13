import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminListRescueProfiles,
  adminReviewRescueProfile,
  type RescueProfile,
} from '../../api/rescues';
import { setRescueStatus, editRescue } from '../../api/admin';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import { ListSkeleton } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';
import { apiErrorMessage } from '../../utils/apiError';

type Tab = 'pending' | 'approved' | 'rejected';

export default function AdminRescuesPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['admin-rescue-profiles', tab, searchTerm],
    queryFn: () => adminListRescueProfiles(tab, searchTerm),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-rescue-profiles'] });

  const review = useMutation({
    mutationFn: (args: { id: string; approve: boolean; note?: string }) =>
      adminReviewRescueProfile(args.id, args.approve, args.note),
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? 'Approved' : 'Rejected');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to review')),
  });

  const changeStatus = useMutation({
    mutationFn: (args: { id: string; status: string; note?: string }) =>
      setRescueStatus(args.id, { status: args.status, note: args.note }),
    onSuccess: () => { toast.success('Status updated'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const saveEdit = useMutation({
    mutationFn: (args: { id: string; data: Record<string, string> }) => editRescue(args.id, args.data),
    onSuccess: () => { toast.success('Rescue updated'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rescue applications</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); setSearchTerm(query); }}
        className="flex gap-2 mb-4"
      >
        <SearchInput className="flex-1" placeholder="Search org name or location..." value={query} onChange={setQuery} />
        <Button type="submit" size="sm">Search</Button>
      </form>

      <div className="flex gap-1 mb-4">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : profiles.length === 0 ? (
        <EmptyState className="py-6" title={`No ${tab} applications`} />
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((p) => (
            <ReviewCard
              key={p.id}
              profile={p}
              tab={tab}
              onReview={(approve, note) => review.mutate({ id: p.id, approve, note })}
              onSetStatus={(status, note) => changeStatus.mutate({ id: p.id, status, note })}
              onEdit={(data) => saveEdit.mutate({ id: p.id, data })}
              busy={review.isPending || changeStatus.isPending || saveEdit.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  profile,
  tab,
  onReview,
  onSetStatus,
  onEdit,
  busy,
}: {
  profile: RescueProfile;
  tab: Tab;
  onReview: (approve: boolean, note?: string) => void;
  onSetStatus: (status: string, note?: string) => void;
  onEdit: (data: Record<string, string>) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'idle' | 'reject'>('idle');
  const [editing, setEditing] = useState(false);
  const [orgName, setOrgName] = useState(profile.org_name);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{profile.org_name}</h3>
            <Badge variant={profile.donations_enabled ? 'success' : 'neutral'} className="uppercase">
              {profile.donations_enabled ? 'Payouts live' : 'No payouts'}
            </Badge>
          </div>
          {profile.location && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{profile.location}</p>
          )}
          <p className="text-2xs text-gray-400 dark:text-gray-500">
            Submitted <TimeAgo value={profile.created_at} />
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{profile.description}</p>
      {(profile.website || profile.donation_url) && (
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline"
            >
              {profile.website}
            </a>
          )}
          {profile.donation_url && (
            <a
              href={profile.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline"
            >
              donate
            </a>
          )}
        </div>
      )}
      {profile.proof_details && (
        <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">Proof: </span>
          <span className="whitespace-pre-wrap">{profile.proof_details}</span>
        </div>
      )}
      {profile.review_note && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Note: </span>
          {profile.review_note}
        </p>
      )}

      {tab === 'pending' && (
        mode === 'idle' ? (
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => onReview(true)} loading={busy}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('reject')}
              disabled={busy}
            >
              Reject…
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
              rows={2}
              placeholder="Reason (shown to the applicant)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => onReview(false, note.trim() || undefined)}
                loading={busy}
              >
                Confirm reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>
                Cancel
              </Button>
            </div>
          </div>
        )
      )}

      {/* Re-review / revoke — available once a decision has already been made. */}
      {tab !== 'pending' && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {profile.status !== 'approved' && (
            <Button size="sm" loading={busy} onClick={() => onSetStatus('approved')}>Approve</Button>
          )}
          {profile.status !== 'rejected' && (
            <Button size="sm" variant="danger" loading={busy} onClick={() => {
              if (confirm(`Revoke ${profile.org_name}? They lose rescue access.`)) onSetStatus('rejected', 'Revoked by admin');
            }}>Revoke</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>Edit</Button>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
          />
          <Button size="sm" loading={busy} disabled={!orgName.trim() || orgName === profile.org_name} onClick={() => { onEdit({ org_name: orgName.trim() }); setEditing(false); }}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
