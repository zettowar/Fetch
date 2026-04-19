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
import Input from '../../components/ui/Input';
import { apiErrorMessage } from '../../utils/apiError';
import { Spinner } from '../../components/ui/Skeleton';

export default function AdminBreedsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-breeds', search],
    queryFn: () => adminListBreeds({ q: search || undefined, limit: 200 }),
  });
  const breeds: AdminBreed[] = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => adminCreateBreed({ name, group: group || null, is_active: isActive }),
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

      <Input
        placeholder="Search breeds..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-col gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Group (optional)" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Sporting, Hound" />
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
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : breeds.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No breeds match.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {breeds.map((b) => (
            <div key={b.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {b.name}
                  {!b.is_active && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {b.group ? `${b.group} · ` : ''}
                  {b.dog_count} dog{b.dog_count === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete "${b.name}"? This fails if any dog uses it.`)) {
                      deleteMutation.mutate(b.id);
                    }
                  }}
                >
                  Del
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
