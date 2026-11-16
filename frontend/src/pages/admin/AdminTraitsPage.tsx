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
import ErrorState from '../../components/ui/ErrorState';
import Input from '../../components/ui/Input';
import SearchInput from '../../components/ui/SearchInput';
import PageHeader from '../../components/ui/PageHeader';
import { apiErrorMessage } from '../../utils/apiError';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { ROWS, ROW_HOVER, segItem } from './adminStyles';

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

  const { data, isLoading, isError, refetch } = useQuery({
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
      <PageHeader
        title="Personality traits"
        className="mb-5"
        action={<Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>Add trait</Button>}
        subtitle={
          <>
            Owners can type their own trait on any pet. New ones land here as
            <span className="font-bold text-navy dark:text-biscuit"> Needs review</span> — approving one adds it
            to the suggested chips in the pet editor. Renaming updates every pet
            using it; rejecting or deleting removes it from them.
          </>
        }
      />

      <SearchInput
        placeholder="Search traits..."
        value={search}
        onChange={setSearch}
        className="mb-3"
      />

      <div className="seg max-w-full overflow-x-auto scrollbar-none mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={segItem(filter === f.value)}
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
          <div className="flex flex-col gap-1.5">
            <span id="admin-trait-species-label" className="field-label">
              Suggested for
            </span>
            <div className="seg self-start" role="group" aria-labelledby="admin-trait-species-label">
              {(['both', 'dog', 'cat'] as const).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  aria-pressed={species === sp}
                  onClick={() => setSpecies(sp)}
                  className={segItem(species === sp)}
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
      ) : isError ? (
        <ErrorState message="Couldn't load traits." onRetry={() => refetch()} />
      ) : traits.length === 0 ? (
        <EmptyState
          className="py-6"
          title={filter === 'pending' ? 'Nothing to review' : 'No traits match'}
        />
      ) : (
        <Card padding="none" className={ROWS}>
          {traits.map((t) => (
            <div key={t.id} className={`p-3 flex items-center gap-3 ${ROW_HOVER}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-navy dark:text-biscuit flex items-center gap-2 flex-wrap">
                  {t.label}
                  {t.status === 'pending' && <Badge variant="warning">Needs review</Badge>}
                  {t.status === 'rejected' && <Badge variant="danger">Rejected</Badge>}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {SPECIES_LABEL[t.species]} · {t.pet_count} pet{t.pet_count === 1 ? '' : 's'}
                  {t.created_by_name ? ` · suggested by ${t.created_by_name}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {t.status !== 'approved' && (
                  <Button
                    size="sm"
                    variant="secondary"
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
