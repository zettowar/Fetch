import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import client from '../../api/client';
import {
  getAdminUser,
  suspendUser,
  reinstateUser,
  promoteUser,
  demoteUser,
  grantEntitlement,
  getUserStrikes,
  getUserReportsFiled,
  getUserReportsAgainst,
  getAuditLog,
} from '../../api/admin';
import type { RescueProfile } from '../../api/rescues';
import BackButton from '../../components/ui/BackButton';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import ErrorState from '../../components/ui/ErrorState';
import { Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';

type Tab = 'strikes' | 'filed' | 'against' | 'rescue' | 'audit';

const TABS: { key: Tab; label: string }[] = [
  { key: 'strikes', label: 'Strikes' },
  { key: 'filed', label: 'Reports filed' },
  { key: 'against', label: 'Reports against' },
  { key: 'rescue', label: 'Rescue profile' },
  { key: 'audit', label: 'Audit trail' },
];

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('strikes');
  const [grantKey, setGrantKey] = useState('ads_removed');
  const [showGrant, setShowGrant] = useState(false);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUser(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(id!),
    onSuccess: () => { toast.success('User suspended'); invalidate(); },
  });
  const reinstateMutation = useMutation({
    mutationFn: () => reinstateUser(id!),
    onSuccess: () => { toast.success('User reinstated'); invalidate(); },
  });
  const promoteMutation = useMutation({
    mutationFn: () => promoteUser(id!),
    onSuccess: () => { toast.success('Promoted to admin'); invalidate(); },
    onError: () => toast.error('Failed to promote'),
  });
  const demoteMutation = useMutation({
    mutationFn: () => demoteUser(id!),
    onSuccess: () => { toast.success('Demoted to regular user'); invalidate(); },
    onError: () => toast.error('Failed to demote'),
  });
  const grantMutation = useMutation({
    mutationFn: () => grantEntitlement({ user_id: id!, entitlement_key: grantKey, source: 'admin_grant' }),
    onSuccess: () => { toast.success('Entitlement granted'); setShowGrant(false); },
    onError: () => toast.error('Failed to grant'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>;
  }
  if (isError || !user) {
    return <ErrorState message="User not found." />;
  }

  return (
    <div>
      <BackButton fallback="/admin/users" />

      {/* Header */}
      <div className="flex items-start gap-4 mt-2 mb-4">
        <Avatar name={user.display_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{user.display_name}</h1>
            {user.role === 'admin' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium uppercase">Admin</span>
            )}
            {!user.is_active && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium uppercase">Suspended</span>
            )}
            {user.strike_count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">{user.strike_count} strike{user.strike_count > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Joined <TimeAgo value={user.created_at} /> · {user.dog_count} dog{user.dog_count !== 1 ? 's' : ''}
            {user.location_rough ? ` · ${user.location_rough}` : ''}
          </p>
          <div className="mt-1">
            <Link to={`/users/${user.id}`} target="_blank" className="text-xs text-brand-500 hover:underline">
              View public profile ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {user.is_active ? (
          <Button size="sm" variant="danger" onClick={() => {
            if (confirm(`Suspend ${user.display_name}?`)) suspendMutation.mutate();
          }}>Suspend</Button>
        ) : (
          <Button size="sm" onClick={() => reinstateMutation.mutate()}>Reinstate</Button>
        )}
        {user.role !== 'admin' ? (
          <Button size="sm" variant="secondary" loading={promoteMutation.isPending} onClick={() => {
            if (confirm(`Promote ${user.display_name} to admin?`)) promoteMutation.mutate();
          }}>Promote to Admin</Button>
        ) : (
          <Button size="sm" variant="ghost" loading={demoteMutation.isPending} onClick={() => {
            if (confirm(`Demote ${user.display_name} from admin?`)) demoteMutation.mutate();
          }}>Demote</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowGrant(!showGrant)}>Grant Entitlement</Button>
      </div>

      {showGrant && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
            value={grantKey}
            onChange={(e) => setGrantKey(e.target.value)}
          >
            <option value="ads_removed">ads_removed</option>
            <option value="premium">premium</option>
            <option value="beta_tester">beta_tester</option>
          </select>
          <Button size="sm" onClick={() => grantMutation.mutate()} loading={grantMutation.isPending}>Grant</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowGrant(false)}>Cancel</Button>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 flex gap-4 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'strikes' && <StrikesTab userId={user.id} />}
      {tab === 'filed' && <ReportsFiledTab userId={user.id} />}
      {tab === 'against' && <ReportsAgainstTab userId={user.id} />}
      {tab === 'rescue' && <RescueProfileTab userId={user.id} />}
      {tab === 'audit' && <AuditTab userId={user.id} />}
    </div>
  );
}

function StrikesTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-strikes', userId],
    queryFn: () => getUserStrikes(userId),
  });
  if (isLoading) return <Spinner className="h-5 w-5 my-4" />;
  if (!data.length) return <p className="text-sm text-gray-400 py-4">No strikes on record.</p>;
  return (
    <ul className="bg-white rounded-xl border border-gray-100 divide-y">
      {data.map((s) => (
        <li key={s.id} className="p-3 text-sm flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="flex-1">{s.reason}</span>
          <span className="text-xs text-gray-400 shrink-0"><TimeAgo value={s.created_at} /></span>
        </li>
      ))}
    </ul>
  );
}

function ReportsFiledTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-reports-filed', userId],
    queryFn: () => getUserReportsFiled(userId),
  });
  if (isLoading) return <Spinner className="h-5 w-5 my-4" />;
  if (!data.length) return <p className="text-sm text-gray-400 py-4">This user hasn't filed any reports.</p>;
  return <ReportList items={data} />;
}

function ReportsAgainstTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-reports-against', userId],
    queryFn: () => getUserReportsAgainst(userId),
  });
  if (isLoading) return <Spinner className="h-5 w-5 my-4" />;
  if (!data.length) return <p className="text-sm text-gray-400 py-4">No reports filed against this user.</p>;
  return <ReportList items={data} />;
}

function ReportList({ items }: { items: Array<{ id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string }> }) {
  return (
    <ul className="bg-white rounded-xl border border-gray-100 divide-y">
      {items.map((r) => (
        <li key={r.id} className="p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
              r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
              r.status === 'reviewed' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>{r.status}</span>
            <span className="text-xs text-gray-500">{r.target_type}</span>
            <span className="text-xs text-gray-400 ml-auto"><TimeAgo value={r.created_at} /></span>
          </div>
          <p className="text-gray-700 mt-1 break-words">{r.reason}</p>
        </li>
      ))}
    </ul>
  );
}

function RescueProfileTab({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery<RescueProfile | null>({
    queryKey: ['admin-user-rescue-profile', userId],
    queryFn: async () =>
      (await client.get(`/admin/users/${userId}/rescue-profile`)).data,
  });
  if (isLoading) return <Spinner className="h-5 w-5 my-4" />;
  if (!data) {
    return <p className="text-sm text-gray-400 py-4">This user isn't a rescue account.</p>;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">{data.org_name}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
            data.status === 'approved'
              ? 'bg-green-100 text-green-700'
              : data.status === 'pending'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {data.status}
        </span>
        <span className="text-xs text-gray-400 ml-auto">
          <TimeAgo value={data.created_at} />
        </span>
      </div>
      {data.location && <p className="text-xs text-gray-500 mb-1">{data.location}</p>}
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.description}</p>
      {data.review_note && (
        <p className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Review note: </span>
          {data.review_note}
        </p>
      )}
    </div>
  );
}

function AuditTab({ userId }: { userId: string }) {
  const { data: byActor = [], isLoading: loadingActor } = useQuery({
    queryKey: ['admin-audit-by-actor', userId],
    queryFn: () => getAuditLog({ actor_id: userId, limit: 100 }),
  });
  const { data: byTarget = [], isLoading: loadingTarget } = useQuery({
    queryKey: ['admin-audit-by-target', userId],
    queryFn: () => getAuditLog({ target_id: userId, limit: 100 }),
  });
  if (loadingActor || loadingTarget) return <Spinner className="h-5 w-5 my-4" />;

  const merged = [...byActor, ...byTarget]
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (!merged.length) {
    return <p className="text-sm text-gray-400 py-4">No audit entries for this user.</p>;
  }

  return (
    <ul className="bg-white rounded-xl border border-gray-100 divide-y">
      {merged.map((e) => (
        <li key={e.id} className="p-3 text-xs flex items-center gap-2">
          <span className="font-mono text-gray-700">{e.action}</span>
          {e.target_type && <span className="text-gray-500">on {e.target_type}</span>}
          <span className="text-gray-400 ml-auto"><TimeAgo value={e.created_at} /></span>
        </li>
      ))}
    </ul>
  );
}
