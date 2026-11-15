import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { apiErrorMessage } from '../../utils/apiError';
import client from '../../api/client';
import {
  getAdminUser,
  suspendUser,
  reinstateUser,
  deleteUser,
  setUserRole,
  editUser,
  resendVerification,
  sendPasswordReset,
  markVerified,
  impersonateUser,
  grantEntitlement,
  revokeEntitlement,
  getUserEntitlements,
  getUserStrikes,
  getUserReportsFiled,
  getUserReportsAgainst,
  getAuditLog,
} from '../../api/admin';
import { useAuth } from '../../store/AuthContext';
import type { RescueProfile } from '../../api/rescues';
import BackButton from '../../components/ui/BackButton';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState, { NOT_FOUND_HINT } from '../../components/ui/ErrorState';
import { ListSkeleton, Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';
import BrandIcon from '../../components/brand/BrandIcon';
import { FIELD, LINK, ROWS, segItem } from './adminStyles';

function errDetail(e: unknown): string | undefined {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
}

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [tab, setTab] = useState<Tab>('strikes');
  const [grantKey, setGrantKey] = useState('ads_removed');
  const [showGrant, setShowGrant] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => getAdminUser(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-user-entitlements', id] });
  };

  const { data: entitlements = [] } = useQuery({
    queryKey: ['admin-user-entitlements', id],
    queryFn: () => getUserEntitlements(id!),
    enabled: !!id,
  });

  const hasPackPlus = entitlements.some((e) => e.entitlement_key === 'ads_removed');

  const packPlusToggle = useMutation({
    mutationFn: async () => {
      if (hasPackPlus) {
        await revokeEntitlement(id!, 'ads_removed');
      } else {
        await grantEntitlement({ user_id: id!, entitlement_key: 'ads_removed', source: 'admin_grant' });
      }
    },
    onSuccess: () => {
      toast.success(hasPackPlus ? 'Pack+ revoked' : 'Pack+ granted');
      invalidate();
    },
    onError: () => toast.error('Failed to update Pack+'),
  });

  const revokeMutation = useMutation({
    mutationFn: (key: string) => revokeEntitlement(id!, key),
    onSuccess: () => { toast.success('Entitlement revoked'); invalidate(); },
    onError: () => toast.error('Failed to revoke'),
  });

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(id!),
    onSuccess: () => { toast.success('User suspended'); invalidate(); },
    // The API refuses some targets with a reason (staff, yourself); without
    // a handler the button just stopped spinning and nothing happened.
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to suspend')),
  });
  const reinstateMutation = useMutation({
    mutationFn: () => reinstateUser(id!),
    onSuccess: () => { toast.success('User reinstated'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to reinstate')),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(id!),
    onSuccess: (res) => {
      toast.success(
        `Account deleted — ${res.pets_deleted} pet${res.pets_deleted !== 1 ? 's' : ''}, ${res.photos_purged} photo${res.photos_purged !== 1 ? 's' : ''} removed`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      navigate('/admin/users');
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Failed to delete account');
      setShowDelete(false);
    },
  });
  const roleMutation = useMutation({
    mutationFn: (role: 'user' | 'moderator' | 'admin') => setUserRole(id!, role),
    onSuccess: () => { toast.success('Role updated'); invalidate(); },
    onError: (e: unknown) => toast.error(errDetail(e) || 'Failed to change role'),
  });
  const verifyMutation = useMutation({
    mutationFn: () => markVerified(id!),
    onSuccess: () => { toast.success('Marked verified'); invalidate(); },
    onError: () => toast.error('Failed'),
  });
  const resendMutation = useMutation({
    mutationFn: () => resendVerification(id!),
    onSuccess: (r) => toast.success(r.detail),
    onError: (e: unknown) => toast.error(errDetail(e) || 'Failed'),
  });
  const resetMutation = useMutation({
    mutationFn: () => sendPasswordReset(id!),
    onSuccess: (r) => toast.success(r.detail),
    onError: () => toast.error('Failed'),
  });
  const impersonateMutation = useMutation({
    mutationFn: () => impersonateUser(id!),
    onSuccess: (r) => {
      // Per-tab override (sessionStorage) so the admin's persistent session in
      // other tabs is untouched. Same-tab navigate boots as the impersonated
      // user; the banner offers a one-click return.
      sessionStorage.setItem('imp_token', r.access_token);
      sessionStorage.setItem('imp_name', r.display_name);
      window.location.assign('/app/home');
    },
    onError: (e: unknown) => toast.error(errDetail(e) || 'Cannot impersonate'),
  });
  const editMutation = useMutation({
    mutationFn: (data: { display_name?: string; email?: string }) => editUser(id!, data),
    onSuccess: () => { toast.success('User updated'); setShowEdit(false); invalidate(); },
    onError: (e: unknown) => toast.error(errDetail(e) || 'Failed to update'),
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
    return <ErrorState message="User not found." hint={NOT_FOUND_HINT} />;
  }

  return (
    <div>
      <BackButton fallback="/admin/users" />

      {/* Header */}
      <div className="flex items-start gap-4 mt-2 mb-4">
        <Avatar name={user.display_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-[28px] leading-none text-navy dark:text-biscuit">{user.display_name}</h1>
            {(user.role === 'admin' || user.role === 'moderator') && (
              <Badge variant="info" className="uppercase">{user.role}</Badge>
            )}
            {user.is_verified ? (
              <Badge variant="success" className="uppercase">Verified</Badge>
            ) : (
              <Badge variant="neutral" className="uppercase">Unverified</Badge>
            )}
            {!user.is_active && (
              <Badge variant="danger" className="uppercase">Suspended</Badge>
            )}
            {user.strike_count > 0 && (
              <Badge variant="warning">{user.strike_count} strike{user.strike_count > 1 ? 's' : ''}</Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">{user.email}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Joined <TimeAgo value={user.created_at} /> · {user.pet_count} pet{user.pet_count !== 1 ? 's' : ''}
            {user.location_rough ? ` · ${user.location_rough}` : ''}
          </p>
          <div className="mt-1">
            <Link to={`/app/users/${user.id}`} target="_blank" className={`text-xs ${LINK}`}>
              View public profile ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {user.is_active ? (
          <Button size="sm" variant="danger" loading={suspendMutation.isPending} onClick={() => {
            if (confirm(`Suspend ${user.display_name}?`)) suspendMutation.mutate();
          }}>Suspend</Button>
        ) : (
          <Button size="sm" loading={reinstateMutation.isPending} onClick={() => reinstateMutation.mutate()}>Reinstate</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowEdit((v) => !v)}>Edit</Button>
        {!user.is_verified && (
          <Button size="sm" variant="secondary" loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
            Mark verified
          </Button>
        )}
        {!user.is_verified && (
          <Button size="sm" variant="ghost" loading={resendMutation.isPending} onClick={() => resendMutation.mutate()}>
            Resend verification
          </Button>
        )}
        <Button size="sm" variant="ghost" loading={resetMutation.isPending} onClick={() => {
          if (confirm(`Email a password reset link to ${user.email}?`)) resetMutation.mutate();
        }}>Send reset</Button>
        {isAdmin && user.role !== 'admin' && user.role !== 'moderator' && (
          <Button size="sm" variant="ghost" loading={impersonateMutation.isPending} onClick={() => {
            if (confirm(`Open a support session as ${user.display_name}? This is logged.`)) impersonateMutation.mutate();
          }}>Log in as</Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowGrant(!showGrant)}>Grant Entitlement</Button>
        <Button
          size="sm"
          variant={hasPackPlus ? 'danger' : 'primary'}
          loading={packPlusToggle.isPending}
          onClick={() => packPlusToggle.mutate()}
        >
          {hasPackPlus ? 'Revoke Pack+' : 'Grant Pack+'}
        </Button>
        {/* Role selector — admin only, and never on your own row. */}
        {isAdmin && user.id !== currentUser?.id && user.role !== 'rescue' && (
          <label className="flex items-center gap-2">
            <span className="field-label">Role</span>
            <select
              className={FIELD}
              value={user.role}
              disabled={roleMutation.isPending}
              onChange={(e) => {
                const role = e.target.value as 'user' | 'moderator' | 'admin';
                if (confirm(`Set ${user.display_name}'s role to ${role}?`)) roleMutation.mutate(role);
              }}
            >
              <option value="user">user</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
          </label>
        )}
      </div>

      {showEdit && (
        <EditUserForm
          displayName={user.display_name}
          email={user.email}
          pending={editMutation.isPending}
          onCancel={() => setShowEdit(false)}
          onSave={(data) => editMutation.mutate(data)}
        />
      )}

      {/* Entitlement chips */}
      {entitlements.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 items-center">
          <span className="eyebrow">Entitlements:</span>
          {entitlements.map((e) => (
            <Badge key={e.id} variant="brand" size="md" className="gap-1.5">
              <span className="font-mono">{e.entitlement_key}</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Revoke "${e.entitlement_key}" from ${user.display_name}?`)) {
                    revokeMutation.mutate(e.entitlement_key);
                  }
                }}
                aria-label={`Revoke ${e.entitlement_key}`}
                className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-navy/60 transition-colors hover:bg-navy hover:text-biscuit dark:text-brand-200/80 dark:hover:bg-brand-200 dark:hover:text-navy"
              >
                <X size={11} strokeWidth={3} aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {showGrant && (
        <div className="mb-4 flex items-center gap-2">
          <select
            className={`${FIELD} font-mono`}
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
      <div className="seg max-w-full overflow-x-auto scrollbar-none mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={segItem(tab === t.key)}
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

      {/* Danger zone — permanent deletion, distinct from reversible suspend */}
      <div className="mt-8 rounded-2xl border-[1.5px] border-danger-300 dark:border-danger-500/40 bg-danger-50 dark:bg-danger-500/5 p-4">
        <h2 className="text-base font-extrabold text-danger-700 dark:text-danger-300">Danger zone</h2>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-700 dark:text-gray-300 max-w-md">
            Permanently delete this account and everything it owns — pets, photos, votes,
            posts, and comments. This <strong>cannot be undone</strong>. To temporarily
            disable access instead, use Suspend above.
          </p>
          {user.role === 'admin' ? (
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
              Demote before deleting
            </span>
          ) : (
            <Button
              size="sm"
              variant="danger"
              className="shrink-0"
              onClick={() => setShowDelete(true)}
            >
              Delete account
            </Button>
          )}
        </div>
      </div>

      {showDelete && (
        <DeleteAccountModal
          displayName={user.display_name}
          email={user.email}
          petCount={user.pet_count}
          pending={deleteMutation.isPending}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
        />
      )}
    </div>
  );
}

function EditUserForm({
  displayName,
  email,
  pending,
  onCancel,
  onSave,
}: {
  displayName: string;
  email: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (data: { display_name?: string; email?: string }) => void;
}) {
  const [name, setName] = useState(displayName);
  const [mail, setMail] = useState(email);
  const dirty = name.trim() !== displayName || mail.trim().toLowerCase() !== email;

  return (
    <div className="surface mb-4 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full ${FIELD}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="field-label">
            Email <span className="normal-case tracking-normal font-semibold text-gray-500 dark:text-gray-400">(changing clears verified)</span>
          </span>
          <input
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            className={`w-full ${FIELD}`}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button
          size="sm"
          loading={pending}
          disabled={!dirty || pending}
          onClick={() => {
            const data: { display_name?: string; email?: string } = {};
            if (name.trim() !== displayName) data.display_name = name.trim();
            if (mail.trim().toLowerCase() !== email) data.email = mail.trim();
            onSave(data);
          }}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

function DeleteAccountModal({
  displayName,
  email,
  petCount,
  pending,
  onCancel,
  onConfirm,
}: {
  displayName: string;
  email: string;
  petCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const matches = confirmText.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl border-[2.5px] border-navy bg-biscuit p-6 shadow-toy dark:border-white/15 dark:bg-night-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-extrabold tracking-tight text-danger-700 dark:text-danger-300">
          Delete {displayName}?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This permanently erases the account, {petCount} pet{petCount !== 1 ? 's' : ''} and all
          their photos, plus every vote, post, comment, and report tied to this user. Donation
          records are kept (anonymized). This action is <strong>irreversible</strong>.
        </p>
        <label htmlFor="admin-delete-user-confirm" className="mt-4 block text-xs font-semibold text-gray-600 dark:text-gray-300">
          Type <span className="font-mono text-navy dark:text-biscuit">{email}</span> to confirm
        </label>
        <input
          id="admin-delete-user-confirm"
          autoFocus
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-1.5 w-full rounded-lg border-[1.5px] border-navy/25 bg-white px-3 py-2 font-mono text-sm text-navy placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out focus:border-danger-500 focus:ring-4 focus:ring-danger-500/20 dark:border-white/20 dark:bg-night dark:text-biscuit dark:placeholder:text-gray-500 dark:focus:border-danger-400"
          placeholder={email}
          autoComplete="off"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={pending}
            disabled={!matches || pending}
            onClick={onConfirm}
          >
            Permanently delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function StrikesTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-strikes', userId],
    queryFn: () => getUserStrikes(userId),
  });
  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data.length) return <EmptyState className="py-6" title="No strikes on record" />;
  return (
    <Card as="ul" padding="none" className={ROWS}>
      {data.map((s) => (
        <li key={s.id} className="p-3 text-sm flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-danger-500 shrink-0" />
          <span className="flex-1">{s.reason}</span>
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0"><TimeAgo value={s.created_at} /></span>
        </li>
      ))}
    </Card>
  );
}

function ReportsFiledTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-reports-filed', userId],
    queryFn: () => getUserReportsFiled(userId),
  });
  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data.length) return <EmptyState className="py-6" title="This user hasn't filed any reports" />;
  return <ReportList items={data} />;
}

function ReportsAgainstTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-reports-against', userId],
    queryFn: () => getUserReportsAgainst(userId),
  });
  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data.length) return <EmptyState className="py-6" title="No reports filed against this user" />;
  return <ReportList items={data} />;
}

function ReportList({ items }: { items: Array<{ id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string }> }) {
  return (
    <Card as="ul" padding="none" className={ROWS}>
      {items.map((r) => (
        <li key={r.id} className="p-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge
              className="uppercase"
              variant={
                r.status === 'pending' ? 'warning' :
                r.status === 'reviewed' ? 'success' :
                'neutral'
              }
            >{r.status}</Badge>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{r.target_type}</span>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 ml-auto"><TimeAgo value={r.created_at} /></span>
          </div>
          <p className="text-gray-700 dark:text-gray-200 mt-1 break-words">{r.reason}</p>
        </li>
      ))}
    </Card>
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
    return <EmptyState className="py-6" title="This user isn't a rescue account" />;
  }
  return (
    <Card className="text-sm">
      <div className="flex items-center gap-2 mb-2">
        <BrandIcon name="rescue" size={20} className="text-navy dark:text-biscuit" />
        <span className="font-extrabold">{data.org_name}</span>
        <Badge
          className="uppercase"
          variant={
            data.status === 'approved' ? 'success' :
            data.status === 'pending' ? 'warning' :
            'danger'
          }
        >
          {data.status}
        </Badge>
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 ml-auto">
          <TimeAgo value={data.created_at} />
        </span>
      </div>
      {data.location && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{data.location}</p>}
      <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{data.description}</p>
      {data.review_note && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-bold text-navy dark:text-biscuit">Review note: </span>
          {data.review_note}
        </p>
      )}
    </Card>
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
  if (loadingActor || loadingTarget) return <ListSkeleton rows={3} />;

  const merged = [...byActor, ...byTarget]
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (!merged.length) {
    return <EmptyState className="py-6" title="No audit entries for this user" />;
  }

  return (
    <Card as="ul" padding="none" className={ROWS}>
      {merged.map((e) => (
        <li key={e.id} className="p-3 text-xs flex items-center gap-2">
          <span className="font-mono font-medium text-navy dark:text-biscuit">{e.action}</span>
          {e.target_type && <span className="text-gray-500 dark:text-gray-400">on {e.target_type}</span>}
          <span className="font-mono text-gray-500 dark:text-gray-400 ml-auto"><TimeAgo value={e.created_at} /></span>
        </li>
      ))}
    </Card>
  );
}
