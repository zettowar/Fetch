import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { generateTags, listAdminTags, adminAssignTag, type AdminTag } from '../../api/tags';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import SearchInput from '../../components/ui/SearchInput';
import PageHeader from '../../components/ui/PageHeader';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { FIELD, ROWS, segItem } from './adminStyles';

type Filter = 'all' | 'unassigned' | 'assigned';

function tagUrl(code: string): string {
  return `${window.location.origin}/t/${code}`;
}

export default function AdminTagsPage() {
  const [count, setCount] = useState(24);
  const [filter, setFilter] = useState<Filter>('unassigned');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [printMode, setPrintMode] = useState(false);
  const queryClient = useQueryClient();

  const assignedParam = filter === 'all' ? undefined : filter === 'assigned';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-tags', filter, search],
    queryFn: () => listAdminTags({ assigned: assignedParam, q: search || undefined, limit: 200 }),
  });
  const tags = data?.items ?? [];
  const total = data?.total ?? 0;

  const genMutation = useMutation({
    mutationFn: () => generateTags(count),
    onSuccess: (codes) => {
      toast.success(`Generated ${codes.length} tags`);
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
    },
    onError: () => toast.error('Failed to generate tags'),
  });

  if (printMode) {
    return <PrintSheet tags={tags} onClose={() => setPrintMode(false)} />;
  }

  return (
    <div>
      <PageHeader title="QR Tags" className="mb-5" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="admin-tags-generate-count" className="field-label shrink-0">Generate</label>
          <input
            id="admin-tags-generate-count"
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`${FIELD} w-20 font-mono`}
          />
          <Button size="sm" onClick={() => genMutation.mutate()} loading={genMutation.isPending}>
            Generate batch
          </Button>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={() => setPrintMode(true)} disabled={!tags.length}>
            Print QR sheet ({tags.length})
          </Button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
          Mint a batch, print the sheet, and stick the codes on physical tags. Owners
          scan to link a tag to their pet; you can also assign one below.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="seg shrink-0">
          {(['unassigned', 'assigned', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`capitalize ${segItem(filter === f)}`}
            >
              {f}
            </button>
          ))}
        </div>
        <form
          className="min-w-[12rem] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <SearchInput placeholder="Search by code…" value={query} onChange={setQuery} />
        </form>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message="Couldn't load tags." onRetry={() => refetch()} />
      ) : tags.length === 0 ? (
        <EmptyState className="py-6" title={`No ${filter} tags`} />
      ) : (
        <>
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mb-2">{total} total</p>
          <Card padding="none" className={ROWS}>
            {tags.map((t) => (
              <TagRow key={t.code} tag={t} />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function TagRow({ tag }: { tag: AdminTag }) {
  const [assigning, setAssigning] = useState(false);
  const [petId, setPetId] = useState('');
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: () => adminAssignTag(tag.code, petId.trim()),
    onSuccess: () => {
      toast.success(`Assigned ${tag.code}`);
      setAssigning(false);
      setPetId('');
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
    },
    onError: () => toast.error('Assign failed — check the pet ID'),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tagUrl(tag.code));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center gap-3">
        <button
          onClick={copy}
          className="font-mono text-sm font-medium tracking-wide text-navy dark:text-biscuit hover:text-brand-700 dark:hover:text-brand-300 hover:underline underline-offset-2 transition-colors"
          title="Copy scan link"
        >
          {tag.code}
        </button>
        <span className="flex-1 min-w-0">
          {tag.pet_id ? (
            <span className="block text-xs text-gray-600 dark:text-gray-300 truncate">
              {tag.pet_name}{tag.owner_email ? ` · ${tag.owner_email}` : ''}
            </span>
          ) : null}
        </span>
        {tag.pet_id ? (
          <Badge variant="success">Linked</Badge>
        ) : (
          <>
            <Badge variant="neutral">Unassigned</Badge>
            <Button size="sm" variant="ghost" onClick={() => setAssigning((v) => !v)}>
              Assign
            </Button>
          </>
        )}
      </div>
      {assigning && (
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Pet ID"
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              placeholder="Paste a pet UUID (from Content)"
            />
          </div>
          <Button size="sm" onClick={() => assign.mutate()} loading={assign.isPending} disabled={!petId.trim()}>
            Link
          </Button>
        </div>
      )}
    </div>
  );
}

function PrintSheet({ tags, onClose }: { tags: AdminTag[]; onClose: () => void }) {
  return (
    // The sheet is a print preview: plain white paper and black ink in both
    // themes, on purpose, so what you see is what the printer gets.
    <div className="rounded-2xl bg-white p-4 text-black print:rounded-none print:p-0">
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
        <h1 className="font-plain text-xl text-navy">QR sheet — {tags.length} tags</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}>Print</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {tags.map((t) => (
          <div key={t.code} className="flex flex-col items-center gap-1 break-inside-avoid p-2 border border-gray-300 rounded-lg">
            <QRCodeSVG value={tagUrl(t.code)} size={104} level="M" />
            <span className="font-mono text-2xs tracking-wide">{t.code}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
