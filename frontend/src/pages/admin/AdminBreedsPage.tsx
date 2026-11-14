import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminListBreeds,
  adminCreateBreed,
  adminUpdateBreed,
  adminDeleteBreed,
  type AdminBreed,
} from '../../api/breeds';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import SearchInput from '../../components/ui/SearchInput';
import { apiErrorMessage } from '../../utils/apiError';
import { ListSkeleton } from '../../components/ui/Skeleton';
import PaginationFooter from '../../components/ui/PaginationFooter';
import type { Species } from '../../types';

const PAGE_SIZE = 100;

export default function AdminBreedsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [isActive, setIsActive] = useState(true);
  // Create-only: a breed's species can't be changed afterwards (pets of the
  // other species may already use it), so the picker hides while editing.
  const [species, setSpecies] = useState<Species>('dog');
  const [offset, setOffset] = useState(0);

  // Paged. This used to ask for the first 200 and stop — with 243 breeds
  // seeded, everything alphabetically after the cut-off was missing from the
  // list and only turned up through search.
  const { data, isLoading } = useQuery({
    queryKey: ['admin-breeds', search, offset],
    queryFn: () => adminListBreeds({ q: search || undefined, offset, limit: PAGE_SIZE }),
  });
  const breeds: AdminBreed[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateBreed({ name, group: group || null, species, is_active: isActive }),
    onSuccess: () => {
      toast.success('Breed added');
      queryClient.invalidateQueries({ queryKey: ['admin-breeds'] });
      queryClient.invalidateQueries({ queryKey: ['breeds'] });
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminUpdateBreed(editId!, { name, group: group || null, is_active: isActive }),
    onSuccess: () => {
      toast.success('Breed updated');
      queryClient.invalidateQueries({ queryKey: ['admin-breeds'] });
      queryClient.invalidateQueries({ queryKey: ['breeds'] });
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: adminDeleteBreed,
    onSuccess: () => {
      toast.success('Breed deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-breeds'] });
      queryClient.invalidateQueries({ queryKey: ['breeds'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setGroup('');
    setIsActive(true);
    setSpecies('dog');
  };

  const startEdit = (b: AdminBreed) => {
    setEditId(b.id);
    setName(b.name);
    setGroup(b.group ?? '');
    setIsActive(b.is_active ?? true);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Breeds</h1>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>Add Breed</Button>
      </div>

      <SearchInput
        placeholder="Search breeds..."
        value={search}
        onChange={(v) => { setSearch(v); setOffset(0); }}
        className="mb-4"
      />

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Group (optional)" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Sporting, Hound" />
          {!editId && (
            // Without this every new breed was created as a dog breed — the
            // form never sent a species, and the API defaults to "dog" — so
            // there was no way to add a cat breed from the admin panel.
            <fieldset className="flex items-center gap-4 text-sm">
              <legend className="mb-1 font-medium text-gray-700 dark:text-gray-300">Species</legend>
              {(['dog', 'cat'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 capitalize">
                  <input
                    type="radio"
                    name="breed-species"
                    checked={species === s}
                    onChange={() => setSpecies(s)}
                  />
                  {s}
                </label>
              ))}
            </fieldset>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (shown to users)
          </label>
          <div className="flex gap-2">
            <Button
              onClick={() => editId ? updateMutation.mutate() : createMutation.mutate()}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!name.trim()}
            >
              {editId ? 'Update' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : breeds.length === 0 ? (
        <EmptyState className="py-6" title="No breeds match" />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {breeds.map((b) => (
            <div key={b.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {b.name}
                  {!b.is_active && <span className="ml-2 text-xs text-danger-500 dark:text-danger-400">(inactive)</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  <span className="capitalize">{b.species ?? 'dog'}</span>
                  {' · '}
                  {b.group ? `${b.group} · ` : ''}
                  {b.pet_count} pet{b.pet_count === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deleteMutation.isPending && deleteMutation.variables === b.id}
                  onClick={() => {
                    if (confirm(`Delete "${b.name}"? This fails if any pet uses it.`)) {
                      deleteMutation.mutate(b.id);
                    }
                  }}
                >
                  Del
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <PaginationFooter
        offset={offset}
        pageSize={PAGE_SIZE}
        rendered={breeds.length}
        total={total}
        onChange={setOffset}
      />
    </div>
  );
}
