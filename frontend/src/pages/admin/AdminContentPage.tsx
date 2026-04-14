import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAdminDogs,
  deactivateDog,
  reactivateDog,
  type AdminDog,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Skeleton';
import { relativeTime } from '../../utils/time';

export default function AdminContentPage() {
  const [dogQuery, setDogQuery] = useState('');
  const [dogSearch, setDogSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();

  const { data: dogs = [], isLoading } = useQuery({
    queryKey: ['admin-dogs', dogSearch, showInactive],
    queryFn: () => getAdminDogs({ q: dogSearch || undefined, active_only: showInactive ? undefined : true }),
    staleTime: 60_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateDog,
    onSuccess: () => {
      toast.success('Dog deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-dogs'] });
    },
    onError: () => toast.error('Failed to deactivate'),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateDog,
    onSuccess: () => {
      toast.success('Dog reactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-dogs'] });
    },
    onError: () => toast.error('Failed to reactivate'),
  });

  const { activeDogs, inactiveDogs } = useMemo(() => ({
    activeDogs: dogs.filter((d: AdminDog) => d.is_active),
    inactiveDogs: dogs.filter((d: AdminDog) => !d.is_active),
  }), [dogs]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Content Moderation</h1>

      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Dog Profiles
          <span className="text-xs font-normal text-gray-400">
            ({activeDogs.length} active{inactiveDogs.length > 0 ? `, ${inactiveDogs.length} inactive` : ''})
          </span>
        </h2>

        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => { e.preventDefault(); setDogSearch(dogQuery); }}
        >
          <div className="flex-1">
            <Input
              placeholder="Search by name or breed..."
              value={dogQuery}
              onChange={(e) => setDogQuery(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive dogs
        </label>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6" />
          </div>
        ) : dogs.length === 0 ? (
          <p className="text-gray-400 text-center py-6">
            {dogSearch ? `No dogs found for "${dogSearch}".` : 'No dogs found.'}
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 divide-y">
            {dogs.map((dog: AdminDog) => (
              <div key={dog.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/dogs/${dog.id}`}
                      target="_blank"
                      className="font-medium text-sm text-brand-600 hover:underline"
                    >
                      {dog.name}
                    </Link>
                    {dog.breed && (
                      <span className="text-xs text-gray-400">{dog.breed}</span>
                    )}
                    {!dog.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                        inactive
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{dog.photo_count} photo{dog.photo_count !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Owner:{' '}
                    <Link to={`/users/${dog.owner_id}`} target="_blank" className="hover:underline">
                      {dog.owner_name ?? 'Unknown'}
                    </Link>
                    {dog.owner_email && (
                      <span className="text-gray-400 ml-1">({dog.owner_email})</span>
                    )}
                    {' · '}
                    {relativeTime(dog.created_at)}
                  </p>
                </div>
                <div className="shrink-0">
                  {dog.is_active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deactivateMutation.isPending}
                      onClick={() => {
                        if (confirm(`Deactivate "${dog.name}"? It will be hidden from swipe and search.`)) {
                          deactivateMutation.mutate(dog.id);
                        }
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={reactivateMutation.isPending}
                      onClick={() => reactivateMutation.mutate(dog.id)}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
