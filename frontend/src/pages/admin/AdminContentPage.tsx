import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAdminDogs,
  deactivateDog,
  reactivateDog,
  getFlaggedPhotos,
  getFlaggedPhotoBlob,
  approvePhoto,
  rejectPhoto,
  type AdminDog,
  type FlaggedPhoto,
} from '../../api/admin';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import TimeAgo from '../../components/TimeAgo';

const PAGE_SIZE = 50;

function FlaggedPhotoImage({ photoId, alt }: { photoId: string; alt: string }) {
  const { data: src } = useQuery({
    queryKey: ['admin-flagged-photo-file', photoId],
    queryFn: async () => URL.createObjectURL(await getFlaggedPhotoBlob(photoId)),
    staleTime: Infinity,
  });
  if (!src) {
    return <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0" />;
  }
  return <img src={src} alt={alt} className="w-16 h-16 rounded-lg object-cover shrink-0" />;
}

function FlaggedPhotoQueue() {
  const queryClient = useQueryClient();
  const { data: photos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-flagged-photos'],
    queryFn: getFlaggedPhotos,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-flagged-photos'] });
  };
  const approveMutation = useMutation({
    mutationFn: approvePhoto,
    onSuccess: () => { toast.success('Photo approved'); invalidate(); },
    onError: () => toast.error('Failed to approve photo'),
  });
  const rejectMutation = useMutation({
    mutationFn: rejectPhoto,
    onSuccess: () => { toast.success('Photo rejected and deleted'); invalidate(); },
    onError: () => toast.error('Failed to reject photo'),
  });

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        Flagged Photos
        {photos.length > 0 && (
          <Badge variant="warning">{photos.length} awaiting review</Badge>
        )}
      </h2>

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <p className="text-sm text-danger-500 text-center py-6">
          Couldn't load the review queue.{' '}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </p>
      ) : photos.length === 0 ? (
        <EmptyState className="py-6" title="No flagged photos" body="The queue is clear." />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {photos.map((p: FlaggedPhoto) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <FlaggedPhotoImage photoId={p.id} alt={`Flagged photo of ${p.dog_name ?? 'a dog'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/app/dogs/${p.dog_id}`}
                    target="_blank"
                    className="font-medium text-sm text-brand-600 hover:underline"
                  >
                    {p.dog_name ?? 'Unknown dog'}
                  </Link>
                  <Badge variant="warning">flagged</Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {p.owner_email ?? 'Unknown owner'}
                  {' · '}
                  <TimeAgo value={p.created_at} />
                </p>
              </div>
              <div className="shrink-0 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={approveMutation.isPending && approveMutation.variables === p.id}
                  onClick={() => approveMutation.mutate(p.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={rejectMutation.isPending && rejectMutation.variables === p.id}
                  onClick={() => {
                    if (confirm('Reject this photo? The file will be permanently deleted.')) {
                      rejectMutation.mutate(p.id);
                    }
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export default function AdminContentPage() {
  const [dogQuery, setDogQuery] = useState('');
  const [dogSearch, setDogSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data: page, isLoading } = useQuery({
    queryKey: ['admin-dogs', dogSearch, showInactive, offset],
    queryFn: () => getAdminDogs({
      q: dogSearch || undefined,
      active_only: showInactive ? undefined : true,
      offset,
      limit: PAGE_SIZE,
    }),
    staleTime: 60_000,
  });
  const dogs = page?.items ?? [];
  const total = page?.total ?? 0;

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Content Moderation</h1>

      <FlaggedPhotoQueue />

      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          Dog Profiles
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
            ({total} total)
          </span>
        </h2>

        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => { e.preventDefault(); setDogSearch(dogQuery); setOffset(0); }}
        >
          <SearchInput
            className="flex-1"
            placeholder="Search by name or breed..."
            value={dogQuery}
            onChange={setDogQuery}
          />
          <Button type="submit" size="sm">Search</Button>
        </form>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded"
            checked={showInactive}
            onChange={(e) => { setShowInactive(e.target.checked); setOffset(0); }}
          />
          Show inactive dogs
        </label>

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : dogs.length === 0 ? (
          <EmptyState
            className="py-6"
            title="No dogs found"
            body={dogSearch ? `Nothing matches "${dogSearch}".` : undefined}
          />
        ) : (
          <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
            {dogs.map((dog: AdminDog) => (
              <div key={dog.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/app/dogs/${dog.id}`}
                      target="_blank"
                      className="font-medium text-sm text-brand-600 hover:underline"
                    >
                      {dog.name}
                    </Link>
                    {dog.breed && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{dog.breed}</span>
                    )}
                    {!dog.is_active && (
                      <Badge variant="danger">inactive</Badge>
                    )}
                    <span className="text-2xs text-gray-400 dark:text-gray-500">{dog.photo_count} photo{dog.photo_count !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Owner:{' '}
                    <Link to={`/app/users/${dog.owner_id}`} target="_blank" className="hover:underline">
                      {dog.owner_name ?? 'Unknown'}
                    </Link>
                    {dog.owner_email && (
                      <span className="text-gray-400 dark:text-gray-500 ml-1">({dog.owner_email})</span>
                    )}
                    {' · '}
                    <TimeAgo value={dog.created_at} />
                  </p>
                </div>
                <div className="shrink-0">
                  {dog.is_active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deactivateMutation.isPending && deactivateMutation.variables === dog.id}
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
                      loading={reactivateMutation.isPending && reactivateMutation.variables === dog.id}
                      onClick={() => reactivateMutation.mutate(dog.id)}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}

        <PaginationFooter
          offset={offset}
          pageSize={PAGE_SIZE}
          rendered={dogs.length}
          total={total}
          onChange={setOffset}
        />
      </div>
    </div>
  );
}
