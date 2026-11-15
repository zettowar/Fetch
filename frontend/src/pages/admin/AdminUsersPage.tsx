import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '../../utils/apiError';
import {
  searchUsers,
  suspendUser,
  reinstateUser,
  getUserStrikes,
  grantEntitlement,
  promoteUser,
  demoteUser,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { exportCsv } from '../../utils/exportCsv';
import { CHECK, FIELD, LINK, LIST_HEAD, ROWS, ROW_HOVER, TRAY } from './adminStyles';

const PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showGrant, setShowGrant] = useState(false);
  const [grantKey, setGrantKey] = useState('ads_removed');
  const queryClient = useQueryClient();

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', searchTerm, offset],
    queryFn: () => searchUsers({ q: searchTerm, offset, limit: PAGE_SIZE }),
  });
  const users = page?.items ?? [];
  const total = page?.total ?? 0;

  const {
    data: strikes = [],
    isError: strikesError,
    refetch: refetchStrikes,
  } = useQuery({
    queryKey: ['admin-strikes', selectedUser],
    queryFn: () => getUserStrikes(selectedUser!),
    enabled: !!selectedUser,
  });

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  const suspendMutation = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      toast.success('User suspended');
      invalidateUsers();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to suspend')),
  });

  const reinstateMutation = useMutation({
    mutationFn: reinstateUser,
    onSuccess: () => {
      toast.success('User reinstated');
      invalidateUsers();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to reinstate')),
  });

  const grantMutation = useMutation({
    mutationFn: (userId: string) =>
      grantEntitlement({ user_id: userId, entitlement_key: grantKey, source: 'admin_grant' }),
    onSuccess: () => {
      toast.success('Entitlement granted');
      setShowGrant(false);
    },
    onError: () => toast.error('Failed to grant'),
  });

  const promoteMutation = useMutation({
    mutationFn: promoteUser,
    onSuccess: () => {
      toast.success('User promoted to admin');
      invalidateUsers();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to promote')),
  });

  const demoteMutation = useMutation({
    mutationFn: demoteUser,
    onSuccess: () => {
      toast.success('User demoted to regular user');
      invalidateUsers();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to demote')),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query);
    setSelectedUser(null);
    setSelectedIds(new Set());
    setOffset(0);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        for (const u of users) next.delete(u.id);
        return next;
      }
      const next = new Set(prev);
      for (const u of users) next.add(u.id);
      return next;
    });
  };

  const bulkMutate = async (ids: string[], fn: (id: string) => Promise<unknown>, verb: string) => {
    const results = await Promise.allSettled(ids.map(fn));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (failed === 0) toast.success(`${verb} ${ok} user${ok !== 1 ? 's' : ''}`);
    else toast.error(`${verb} ${ok}/${ids.length} — ${failed} failed`);
    invalidateUsers();
    setSelectedIds(new Set());
  };

  const handleBulkSuspend = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(`Suspend ${ids.length} user${ids.length > 1 ? 's' : ''}?`)) return;
    bulkMutate(ids, suspendUser, 'Suspended');
  };

  const handleBulkReinstate = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    bulkMutate(ids, reinstateUser, 'Reinstated');
  };

  const userCsvColumns = useMemo(
    () => [
      { header: 'id', get: (u: typeof users[number]) => u.id },
      { header: 'email', get: (u: typeof users[number]) => u.email },
      { header: 'display_name', get: (u: typeof users[number]) => u.display_name },
      { header: 'role', get: (u: typeof users[number]) => u.role },
      { header: 'is_active', get: (u: typeof users[number]) => u.is_active },
      { header: 'is_verified', get: (u: typeof users[number]) => u.is_verified },
      { header: 'pet_count', get: (u: typeof users[number]) => u.pet_count },
      { header: 'strike_count', get: (u: typeof users[number]) => u.strike_count },
      { header: 'created_at', get: (u: typeof users[number]) => u.created_at },
    ],
    [],
  );

  const exportSelected = () => {
    const rows = users.filter((u) => selectedIds.has(u.id));
    if (!rows.length) return;
    exportCsv(`users-selected-${new Date().toISOString().slice(0, 10)}.csv`, rows, userCsvColumns);
  };

  const exportPage = () => {
    if (!users.length) return;
    exportCsv(`users-page-${new Date().toISOString().slice(0, 10)}.csv`, users, userCsvColumns);
  };

  // Filter shortcuts (on current page only)
  const suspended = users.filter((u) => !u.is_active);
  const admins = users.filter((u) => u.role === 'admin');
  const withStrikes = users.filter((u) => u.strike_count > 0);
  const selectedCount = selectedIds.size;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + users.length, total);

  return (
    <div>
      <PageHeader
        title="Users"
        className="mb-5"
        action={
          <Button size="sm" variant="secondary" onClick={exportPage} disabled={!users.length}>
            Export page CSV
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <SearchInput
          className="flex-1"
          placeholder="Search by email or name..."
          value={query}
          onChange={setQuery}
        />
        <Button type="submit" size="sm" variant="secondary">Search</Button>
      </form>

      {/* Bulk action bar (visible when any row is selected) */}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 pl-3 bg-brand-50 dark:bg-brand-500/10 border-[1.5px] border-brand-300 dark:border-brand-500/40 rounded-2xl text-sm">
          <span className="font-extrabold text-brand-800 dark:text-brand-200">{selectedCount} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="danger" onClick={handleBulkSuspend}>Suspend</Button>
          <Button size="sm" onClick={handleBulkReinstate}>Reinstate</Button>
          <Button size="sm" variant="secondary" onClick={exportSelected}>Export CSV</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      ) : (
        !isError && users.length > 0 && (
          <div className="flex gap-3 mb-3 text-xs font-semibold">
            <span className="font-mono font-normal text-gray-500 dark:text-gray-400">
              {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : `${users.length} results`}
            </span>
            {suspended.length > 0 && (
              <span className="text-danger-600 dark:text-danger-400">{suspended.length} suspended</span>
            )}
            {withStrikes.length > 0 && (
              <span className="text-warning-800 dark:text-warning-300">{withStrikes.length} with strikes</span>
            )}
            {admins.length > 0 && (
              <span className="text-navy dark:text-gray-200">{admins.length} admin{admins.length > 1 ? 's' : ''}</span>
            )}
          </div>
        )
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load users." onRetry={() => refetch()} />
      ) : users.length === 0 ? (
        <EmptyState
          className="py-6"
          title="No users found"
          body={searchTerm ? `Nothing matches "${searchTerm}".` : undefined}
        />
      ) : (
        <Card padding="none" className={ROWS}>
          <div className={`flex items-center gap-3 px-3 py-2 ${LIST_HEAD}`}>
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAll}
              aria-label="Select all on this page"
              className={CHECK}
            />
            <span>User</span>
          </div>
          {users.map((u) => (
            <div key={u.id}>
              <div className={`flex items-center gap-3 p-3 ${ROW_HOVER}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleOne(u.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${u.display_name}`}
                  className={CHECK}
                />
                <button
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar name={u.display_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy dark:text-biscuit">{u.display_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {u.role === 'admin' && <Badge variant="info">admin</Badge>}
                    {!u.is_active && <Badge variant="danger">suspended</Badge>}
                    {u.strike_count > 0 && <Badge variant="warning">{u.strike_count} strike{u.strike_count > 1 ? 's' : ''}</Badge>}
                    <span className="text-2xs font-semibold text-gray-500 dark:text-gray-400">{u.pet_count} pet{u.pet_count !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              </div>

              {selectedUser === u.id && (
                <div className={`px-4 pb-4 ${TRAY}`}>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600 dark:text-gray-300">
                    <p><span className="font-bold text-navy dark:text-biscuit">Joined:</span> <TimeAgo value={u.created_at} className="font-mono" /></p>
                    <p><span className="font-bold text-navy dark:text-biscuit">Location:</span> {u.location_rough || 'Not set'}</p>
                    <p><span className="font-bold text-navy dark:text-biscuit">Verified:</span> {u.is_verified ? 'Yes' : 'No'}</p>
                    <p>
                      <span className="font-bold text-navy dark:text-biscuit">Profile:</span>{' '}
                      <Link to={`/app/users/${u.id}`} className={LINK} target="_blank">View</Link>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link to={`/admin/users/${u.id}`} className="btn btn-secondary btn-sm">
                      Full details →
                    </Link>
                    {u.is_active ? (
                      <Button size="sm" variant="danger" loading={suspendMutation.isPending} onClick={() => {
                        if (confirm(`Suspend ${u.display_name}?`)) suspendMutation.mutate(u.id);
                      }}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" loading={reinstateMutation.isPending} onClick={() => reinstateMutation.mutate(u.id)}>
                        Reinstate
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setShowGrant(!showGrant)}>
                      Grant Entitlement
                    </Button>
                    {/* Rescue accounts are off the user → admin ladder: the
                        role gates their dashboard and nothing can assign it
                        back, so the API refuses and the buttons don't show. */}
                    {u.role === 'rescue' ? null : u.role !== 'admin' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={promoteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Promote ${u.display_name} to admin?`)) promoteMutation.mutate(u.id);
                        }}
                      >
                        Promote to Admin
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={demoteMutation.isPending}
                        onClick={() => {
                          if (confirm(`Demote ${u.display_name} from admin?`)) demoteMutation.mutate(u.id);
                        }}
                      >
                        Demote
                      </Button>
                    )}
                  </div>

                  {showGrant && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className={`${FIELD} font-mono`}
                        value={grantKey}
                        onChange={(e) => setGrantKey(e.target.value)}
                      >
                        <option value="ads_removed">ads_removed</option>
                        <option value="premium">premium</option>
                        <option value="beta_tester">beta_tester</option>
                      </select>
                      <Button size="sm" onClick={() => grantMutation.mutate(u.id)} loading={grantMutation.isPending}>
                        Grant
                      </Button>
                    </div>
                  )}

                  {/* An empty list here reads as "no strikes", so a failed
                      load has to say so rather than leave the section out. */}
                  {strikesError ? (
                    <div className="mt-3">
                      <ErrorState message="Couldn't load strike history." onRetry={() => refetchStrikes()} />
                    </div>
                  ) : strikes.length > 0 && (
                    <div className="mt-3">
                      <p className="eyebrow mb-1">Strike History ({strikes.length})</p>
                      <div className="space-y-1">
                        {strikes.map((s) => (
                          <div key={s.id} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 py-1 border-b border-gray-200 dark:border-white/10 last:border-0">
                            <span className="w-2 h-2 rounded-full bg-danger-500 shrink-0" />
                            <span className="flex-1">{s.reason}</span>
                            <span className="font-mono text-gray-500 dark:text-gray-400 shrink-0"><TimeAgo value={s.created_at} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {!isError && (
        <PaginationFooter
          offset={offset}
          pageSize={PAGE_SIZE}
          rendered={users.length}
          total={total}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
