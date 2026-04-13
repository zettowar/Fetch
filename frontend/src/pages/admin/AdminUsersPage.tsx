import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { searchUsers, suspendUser, reinstateUser, getUserStrikes, grantEntitlement } from '../../api/admin';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Avatar from '../../components/ui/Avatar';
import { relativeTime } from '../../utils/time';

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [grantKey, setGrantKey] = useState('ads_removed');
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm],
    queryFn: () => searchUsers(searchTerm),
  });

  const { data: strikes = [] } = useQuery({
    queryKey: ['admin-strikes', selectedUser],
    queryFn: () => getUserStrikes(selectedUser!),
    enabled: !!selectedUser,
  });

  const suspendMutation = useMutation({
    mutationFn: suspendUser,
    onSuccess: () => {
      toast.success('User suspended');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: reinstateUser,
    onSuccess: () => {
      toast.success('User reinstated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query);
    setSelectedUser(null);
  };

  // Filter shortcuts
  const suspended = users.filter((u) => !u.is_active);
  const admins = users.filter((u) => u.role === 'admin');
  const withStrikes = users.filter((u) => u.strike_count > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>

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

      {/* Quick filters */}
      {searchTerm && users.length > 0 && (
        <div className="flex gap-2 mb-3 text-xs">
          <span className="text-gray-400">{users.length} results</span>
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
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          {searchTerm ? `No users found for "${searchTerm}".` : 'No users found.'}
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {users.map((u) => (
            <div key={u.id}>
              <button
                onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
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

              {selectedUser === u.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                    <p><span className="font-medium">Joined:</span> {relativeTime(u.created_at)}</p>
                    <p><span className="font-medium">Location:</span> {u.location_rough || 'Not set'}</p>
                    <p><span className="font-medium">Verified:</span> {u.is_verified ? 'Yes' : 'No'}</p>
                    <p>
                      <span className="font-medium">Profile:</span>{' '}
                      <Link to={`/users/${u.id}`} className="text-brand-500 hover:underline" target="_blank">View</Link>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
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
                  </div>

                  {/* Grant entitlement form */}
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

                  {/* Strike history */}
                  {strikes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Strike History ({strikes.length})</p>
                      <div className="space-y-1">
                        {strikes.map((s) => (
                          <div key={s.id} className="text-xs text-gray-500 flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            <span className="flex-1">{s.reason}</span>
                            <span className="text-gray-400 shrink-0">{relativeTime(s.created_at)}</span>
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
    </div>
  );
}
