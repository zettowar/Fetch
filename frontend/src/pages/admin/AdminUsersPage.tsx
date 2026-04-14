import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import Input from '../../components/ui/Input';
import Avatar from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';
import { exportCsv } from '../../utils/exportCsv';

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

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm, offset],
    queryFn: () => searchUsers({ q: searchTerm, offset, limit: PAGE_SIZE }),
  });
  const users = page?.items ?? [];
  const total = page?.total ?? 0;

  const { data: strikes = [] } = useQuery({
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
  });

  const reinstateMutation = useMutation({
    mutationFn: reinstateUser,
    onSuccess: () => {
      toast.success('User reinstated');
      invalidateUsers();
    },
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
    onError: () => toast.error('Failed to promote'),
  });

  const demoteMutation = useMutation({
    mutationFn: demoteUser,
    onSuccess: () => {
      toast.success('User demoted to regular user');
      invalidateUsers();
    },
    onError: () => toast.error('Failed to demote'),
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
      { header: 'dog_count', get: (u: typeof users[number]) => u.dog_count },
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button size="sm" variant="secondary" onClick={exportPage} disabled={!users.length}>
          Export page CSV
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search by email or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm">Search</Button>
      </form>

      {/* Bulk action bar (visible when any row is selected) */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-2 mb-3 p-2 bg-brand-50 border border-brand-200 rounded-lg text-sm">
          <span className="font-medium text-brand-700">{selectedCount} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="danger" onClick={handleBulkSuspend}>Suspend</Button>
          <Button size="sm" onClick={handleBulkReinstate}>Reinstate</Button>
          <Button size="sm" variant="secondary" onClick={exportSelected}>Export CSV</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      ) : (
        users.length > 0 && (
          <div className="flex gap-2 mb-3 text-xs">
            <span className="text-gray-400">
              {total > 0 ? `${rangeStart}–${rangeEnd} of ${total}` : `${users.length} results`}
            </span>
            {suspended.length > 0 && (
              <span className="text-red-500">{suspended.length} suspended</span>
            )}
            {withStrikes.length > 0 && (
              <span className="text-amber-500">{withStrikes.length} with strikes</span>
            )}
            {admins.length > 0 && (
              <span className="text-purple-500">{admins.length} admin{admins.length > 1 ? 's' : ''}</span>
            )}
          </div>
        )
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          {searchTerm ? `No users found for "${searchTerm}".` : 'No users found.'}
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAll}
              aria-label="Select all on this page"
              className="accent-brand-500"
            />
            <span>User</span>
          </div>
          {users.map((u) => (
            <div key={u.id}>
              <div className="flex items-center gap-3 p-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleOne(u.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${u.display_name}`}
                  className="accent-brand-500"
                />
                <button
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar name={u.display_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {u.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">admin</span>}
                    {!u.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">suspended</span>}
                    {u.strike_count > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">{u.strike_count} strike{u.strike_count > 1 ? 's' : ''}</span>}
                    <span className="text-[10px] text-gray-400">{u.dog_count} dog{u.dog_count !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              </div>

              {selectedUser === u.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                    <p><span className="font-medium">Joined:</span> <TimeAgo value={u.created_at} /></p>
                    <p><span className="font-medium">Location:</span> {u.location_rough || 'Not set'}</p>
                    <p><span className="font-medium">Verified:</span> {u.is_verified ? 'Yes' : 'No'}</p>
                    <p>
                      <span className="font-medium">Profile:</span>{' '}
                      <Link to={`/users/${u.id}`} className="text-brand-500 hover:underline" target="_blank">View</Link>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <Link to={`/admin/users/${u.id}`}>
                      <Button size="sm" variant="secondary">Full details →</Button>
                    </Link>
                    {u.is_active ? (
                      <Button size="sm" variant="danger" onClick={() => {
                        if (confirm(`Suspend ${u.display_name}?`)) suspendMutation.mutate(u.id);
                      }}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => reinstateMutation.mutate(u.id)}>
                        Reinstate
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setShowGrant(!showGrant)}>
                      Grant Entitlement
                    </Button>
                    {u.role !== 'admin' ? (
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
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
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

                  {strikes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Strike History ({strikes.length})</p>
                      <div className="space-y-1">
                        {strikes.map((s) => (
                          <div key={s.id} className="text-xs text-gray-500 flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            <span className="flex-1">{s.reason}</span>
                            <span className="text-gray-400 shrink-0"><TimeAgo value={s.created_at} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <Button
            size="sm"
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Prev
          </Button>
          <span className="text-xs text-gray-500">
            {rangeStart}–{rangeEnd} of {total}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={rangeEnd >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
