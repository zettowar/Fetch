import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  adminListTraits,
  adminCreateTrait,
  adminUpdateTrait,
  adminDeleteTrait,
  validateTrait,
  MAX_TRAIT_LENGTH,
  type AdminTrait,
  type TraitSpecies,
  type TraitStatus,
} from '../../api/traits';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import SearchInput from '../../components/ui/SearchInput';
import { apiErrorMessage } from '../../utils/apiError';
import { ListSkeleton } from '../../components/ui/Skeleton';

const SPECIES_LABEL: Record<TraitSpecies, string> = {
  both: 'Dogs & cats',
  dog: 'Dogs only',
  cat: 'Cats only',
};

const FILTERS: { value: TraitStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function AdminTraitsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TraitStatus | 'all'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [species, setSpecies] = useState<TraitSpecies>('both');
  const [sortOrder, setSortOrder] = useState('0');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-traits', search, filter],
    queryFn: () =>
      adminListTraits({
        q: search || undefined,
        status: filter === 'all' ? undefined : filter,
        limit: 200,
      }),
  });
  const traits: AdminTrait[] = data?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-traits'] });
    // The pet editor's chip list comes from the same vocabulary.
    queryClient.invalidateQueries({ queryKey: ['trait-options'] });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setLabel('');
    setSpecies('both');
    setSortOrder('0');
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { label, species, sort_order: Number(sortOrder) || 0 };
      return editId
        ? adminUpdateTrait(editId, body)
        : adminCreateTrait({ ...body, status: 'approved' });
    },
    onSuccess: () => {
      toast.success(editId ? 'Trait updated' : 'Trait added');
      invalidate();
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TraitStatus }) =>
      adminUpdateTrait(id, { status }),
    onSuccess: (trait) => {
      toast.success(trait.status === 'approved' ? 'Trait approved' : 'Trait rejected');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: adminDeleteTrait,
    onSuccess: (res) => {
      toast.success(
        res.pets_stripped > 0
          ? `Trait deleted — removed from ${res.pets_stripped} pet${res.pets_stripped === 1 ? '' : 's'}`
          : 'Trait deleted',
      );
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed')),
  });

  const startEdit = (t: AdminTrait) => {
    setEditId(t.id);
    setLabel(t.label);
    setSpecies(t.species);
    setSortOrder(String(t.sort_order));
    setShowForm(true);
  };

  const labelProblem = label.trim() ? validateTrait(label) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Personality traits</h1>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>Add Trait</Button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Owners can type their own trait on any pet. New ones land here as
        <span className="font-medium"> Needs review</span> — approving one adds it
        to the suggested chips in the pet editor. Renaming updates every pet
        using it; rejecting or deleting removes it from them.
      </p>

      <SearchInput
        placeholder="Search traits..."
        value={search}
        onChange={setSearch}
        className="mb-3"
      />

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <Input
            label="Trait"
            value={label}
            maxLength={MAX_TRAIT_LENGTH}
            onChange={(e) => setLabel(e.target.value)}
            error={labelProblem ?? undefined}
            placeholder="e.g. Good with kids"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Suggested for
            </label>
            <div className="flex gap-2">
              {(['both', 'dog', 'cat'] as const).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpecies(sp)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                    species === sp
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                  }`}
                >
                  {SPECIES_LABEL[sp]}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!label.trim() || !!labelProblem}
            >
              {editId ? 'Update' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : traits.length === 0 ? (
        <EmptyState
          className="py-6"
          title={filter === 'pending' ? 'Nothing to review' : 'No traits match'}
        />
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {traits.map((t) => (
            <div key={t.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  {t.label}
                  {t.status === 'pending' && <Badge variant="warning">Needs review</Badge>}
                  {t.status === 'rejected' && <Badge variant="danger">Rejected</Badge>}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {SPECIES_LABEL[t.species]} · {t.pet_count} pet{t.pet_count === 1 ? '' : 's'}
                  {t.created_by_name ? ` · suggested by ${t.created_by_name}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {t.status !== 'approved' && (
                  <Button
                    size="sm"
                    loading={statusMutation.isPending && statusMutation.variables?.id === t.id}
                    onClick={() => statusMutation.mutate({ id: t.id, status: 'approved' })}
                  >
                    Approve
                  </Button>
                )}
                {t.status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const warning = t.pet_count
                        ? ` It will be removed from ${t.pet_count} pet${t.pet_count === 1 ? '' : 's'}.`
                        : '';
                      if (confirm(`Reject "${t.label}"?${warning}`)) {
                        statusMutation.mutate({ id: t.id, status: 'rejected' });
                      }
                    }}
                  >
                    Reject
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deleteMutation.isPending && deleteMutation.variables === t.id}
                  onClick={() => {
                    const warning = t.pet_count
                      ? ` It will be removed from ${t.pet_count} pet${t.pet_count === 1 ? '' : 's'}.`
                      : '';
                    if (confirm(`Delete "${t.label}"?${warning}`)) deleteMutation.mutate(t.id);
                  }}
                >
                  Del
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
