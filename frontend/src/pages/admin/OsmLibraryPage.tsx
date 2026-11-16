import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import SearchInput from '../../components/ui/SearchInput';
import { ListSkeleton, Spinner } from '../../components/ui/Skeleton';
import PageHeader from '../../components/ui/PageHeader';
import TimeAgo from '../../components/TimeAgo';
import { apiErrorMessage } from '../../utils/apiError';
import { FIELD, LINK, ROWS, ROW_HOVER, STAT_NUMBER, segItem } from './adminStyles';

// Shared "OSM-imported catalog + manual entries" admin page. AdminParksPage
// and AdminVetsPage were ~95% identical; each is now a config over this.

type Bbox = [number, number, number, number];
type Tab = 'import' | 'manual';

interface ImportResponse { created: number; updated: number; total_fetched: number; errors: string[] }
interface ImportHistoryEntry {
  id: string; actor_id: string | null; actor_name: string | null;
  created: number; updated: number; total_fetched: number; bbox: Bbox | null; created_at: string;
}
interface LibraryStats { total: number; by_source: Record<string, number> }
interface LibraryRecord {
  id: string; name: string; address: string | null; lat: number; lng: number;
  created_at: string;
  [key: string]: unknown;
}

export interface Preset { key: string; label: string; bbox: Bbox | null; note?: string }

export interface ExtraField {
  key: string;
  label: string;
  placeholder?: string;
  fullWidth?: boolean;
}

export interface OsmLibraryConfig {
  title: string;               // page heading, e.g. 'Pet parks library'
  entityLabel: string;         // singular, e.g. 'park' / 'vet clinic'
  totalLabel: string;          // e.g. 'Total parks'
  addLabel: string;            // e.g. '+ Add park'
  adminBase: string;           // '/admin/parks' — stats/import/list endpoints
  crudBase: string;            // '/parks' — manual create/update/delete
  queryPrefix: string;         // 'admin-parks' — TanStack Query key namespace
  importDescription: string;
  sourceLinks: { href: string; label: string }[];
  presets: Preset[];
  defaultSpinnerNote: string;  // e.g. '30s'
  extraFields: ExtraField[];   // entity-specific form fields (vet phone/website/hours)
  rowExtra?: (r: LibraryRecord) => string; // extra text in the list row detail line
}

const inputClass = `w-full ${FIELD}`;
const labelClass = 'field-label block mb-1.5';
const SUBHEAD = 'text-base font-extrabold text-navy dark:text-biscuit';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function OsmLibraryPage({ config }: { config: OsmLibraryConfig }) {
  const [tab, setTab] = useState<Tab>('import');
  const [selected, setSelected] = useState('sf');

  const { data: stats, isError: statsError, refetch: refetchStats } = useQuery<LibraryStats>({
    queryKey: [`${config.queryPrefix}-stats`],
    queryFn: async () => (await client.get(`${config.adminBase}/stats`)).data,
  });

  return (
    <div>
      <PageHeader title={config.title} className="mb-5" />

      {statsError ? (
        <ErrorState message={`Couldn't load ${config.entityLabel} counts.`} onRetry={() => refetchStats()} />
      ) : (
        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={config.totalLabel} value={stats?.total ?? '—'} />
          <StatCard label="From OpenStreetMap" value={stats?.by_source?.osm ?? 0} accent="brand" />
          <StatCard label="User-submitted" value={stats?.by_source?.user ?? 0} />
          <StatCard label="Seed / other" value={(stats?.by_source?.seed ?? 0) + (stats?.by_source?.unknown ?? 0)} />
        </section>
      )}

      <div className="seg mb-5">
        {(['import', 'manual'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={segItem(tab === t)}
          >
            {t === 'import' ? 'OSM Import' : 'Manual entries'}
          </button>
        ))}
      </div>

      {tab === 'import' ? (
        <ImportTab config={config} selected={selected} setSelected={setSelected} />
      ) : (
        <ManualTab config={config} />
      )}
    </div>
  );
}

function ImportTab({
  config,
  selected,
  setSelected,
}: {
  config: OsmLibraryConfig;
  selected: string;
  setSelected: (s: string) => void;
}) {
  const queryClient = useQueryClient();
  const {
    data: history = [],
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery<ImportHistoryEntry[]>({
    queryKey: [`${config.queryPrefix}-history`],
    queryFn: async () => (await client.get(`${config.adminBase}/import-history`)).data,
  });

  const runImport = useMutation<ImportResponse, unknown, Bbox | null>({
    mutationFn: async (bbox) => (await client.post(`${config.adminBase}/import-osm`, { bbox })).data,
    onSuccess: (data) => {
      toast.success(`Imported: +${data.created} new, ${data.updated} updated (from ${data.total_fetched})`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: [`${config.queryPrefix}-stats`] });
      queryClient.invalidateQueries({ queryKey: [`${config.queryPrefix}-history`] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Import failed')),
  });

  const activePreset = config.presets.find((p) => p.key === selected)!;

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{config.importDescription}</p>
      <Card as="section" className="mb-7">
        <h2 className={`${SUBHEAD} mb-3`}>Import region</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {config.presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`chip ${selected === p.key ? 'chip-on' : 'hover:bg-gray-50 dark:hover:bg-night-surface'}`}
            >
              {p.label}
              {p.note && (
                <span className={`text-2xs font-semibold ${selected === p.key ? 'text-navy' : 'text-gray-500 dark:text-gray-400'}`}>
                  ({p.note})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Source:{' '}
            {config.sourceLinks.map((link, i) => (
              <span key={link.href}>
                {i > 0 && ' + '}
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={`font-mono ${LINK}`}>
                  {link.label}
                </a>
              </span>
            ))}{' '}
            via Overpass API
          </p>
          <Button onClick={() => runImport.mutate(activePreset.bbox)} loading={runImport.isPending}>
            Import {activePreset.label}
          </Button>
        </div>
        {runImport.isPending && (
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
            <Spinner className="h-3 w-3" />
            Querying Overpass… this can take up to {activePreset.note ?? config.defaultSpinnerNote}.
          </p>
        )}
      </Card>

      <section>
        <h2 className={`${SUBHEAD} mb-3`}>Recent imports</h2>
        {historyLoading ? (
          <ListSkeleton rows={3} />
        ) : historyError ? (
          <ErrorState message="Couldn't load import history." onRetry={() => refetchHistory()} />
        ) : history.length === 0 ? (
          <EmptyState className="py-6" title="No imports yet" />
        ) : (
          <Card padding="none" className={ROWS}>
            {history.map((h) => (
              <div key={h.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy dark:text-biscuit">{h.bbox ? bboxLabel(config.presets, h.bbox) : 'Worldwide'}</p>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">{h.actor_name ?? 'admin'} · <TimeAgo value={h.created_at} className="font-mono" /></p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-gray-600 dark:text-gray-300 shrink-0">
                  <span className="font-medium text-success-700 dark:text-success-400">+{h.created}</span>
                  <span>~{h.updated}</span>
                  <span className="text-gray-500 dark:text-gray-400">of {h.total_fetched}</span>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}

function ManualTab({ config }: { config: OsmLibraryConfig }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('user');
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const fieldId = useId();

  const emptyForm = (): Record<string, string> => ({
    name: '', address: '', lat: '', lng: '',
    ...Object.fromEntries(config.extraFields.map((f) => [f.key, ''])),
  });
  const [form, setForm] = useState<Record<string, string>>(emptyForm);

  const { data: records = [], isLoading, isError, refetch } = useQuery<LibraryRecord[]>({
    queryKey: [`${config.queryPrefix}-list`, search, source],
    queryFn: async () => {
      const params = new URLSearchParams({ q: search, limit: '100' });
      if (source) params.set('source', source);
      return (await client.get(`${config.adminBase}/list?${params}`)).data;
    },
  });

  const resetForm = () => setForm(emptyForm());
  const extraPayload = () =>
    Object.fromEntries(config.extraFields.map((f) => [f.key, form[f.key] || null]));

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: [`${config.queryPrefix}-list`] });
  };
  const invalidateStats = () => {
    queryClient.invalidateQueries({ queryKey: [`${config.queryPrefix}-stats`] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      client.post(config.crudBase, {
        name: form.name,
        address: form.address || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        ...extraPayload(),
      }),
    onSuccess: () => {
      toast.success(`${capitalize(config.entityLabel)} created`);
      invalidateList();
      invalidateStats();
      setShowCreate(false);
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Create failed')),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      client.patch(`${config.crudBase}/${id}`, {
        name: form.name,
        address: form.address || null,
        ...extraPayload(),
      }),
    onSuccess: () => {
      toast.success(`${capitalize(config.entityLabel)} updated`);
      invalidateList();
      setEditId(null);
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Update failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`${config.crudBase}/${id}`),
    onSuccess: () => {
      toast.success(`${capitalize(config.entityLabel)} deleted`);
      invalidateList();
      invalidateStats();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Delete failed')),
  });

  const startEdit = (r: LibraryRecord) => {
    setEditId(r.id);
    setShowCreate(false);
    setForm({
      name: r.name,
      address: r.address ?? '',
      lat: String(r.lat),
      lng: String(r.lng),
      ...Object.fromEntries(config.extraFields.map((f) => [f.key, String(r[f.key] ?? '')])),
    });
  };

  const startCreate = () => { setEditId(null); resetForm(); setShowCreate(true); };
  const cancel = () => { setEditId(null); setShowCreate(false); resetForm(); };
  const isFormValid = form.name.trim() && (editId || (form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng))));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SearchInput
          placeholder="Search by name…"
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-0"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={`${FIELD} min-h-[44px]`}
        >
          <option value="">All sources</option>
          <option value="user">Manual (user)</option>
          <option value="osm">OSM</option>
        </select>
        <Button size="sm" onClick={startCreate}>{config.addLabel}</Button>
      </div>

      {(showCreate || editId) && (
        <Card className="mb-4">
          <h3 className={`${SUBHEAD} mb-3`}>
            {editId ? `Edit ${config.entityLabel}` : `New ${config.entityLabel}`}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-name`} className={labelClass}>Name *</label>
              <input id={`${fieldId}-name`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`${fieldId}-address`} className={labelClass}>Address</label>
              <input id={`${fieldId}-address`} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} />
            </div>
            {!editId && (
              <>
                <div>
                  <label htmlFor={`${fieldId}-lat`} className={labelClass}>Latitude *</label>
                  <input id={`${fieldId}-lat`} type="number" step="any" placeholder="e.g. 37.7749" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} className={`${inputClass} font-mono`} />
                </div>
                <div>
                  <label htmlFor={`${fieldId}-lng`} className={labelClass}>Longitude *</label>
                  <input id={`${fieldId}-lng`} type="number" step="any" placeholder="e.g. -122.4194" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} className={`${inputClass} font-mono`} />
                </div>
              </>
            )}
            {config.extraFields.map((f) => (
              <div key={f.key} className={f.fullWidth ? 'sm:col-span-2' : undefined}>
                <label htmlFor={`${fieldId}-extra-${f.key}`} className={labelClass}>{f.label}</label>
                <input
                  id={`${fieldId}-extra-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              disabled={!isFormValid}
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={() => editId ? updateMutation.mutate(editId) : createMutation.mutate()}
            >
              {editId ? 'Update' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <ErrorState message={`Couldn't load ${config.entityLabel}s.`} onRetry={() => refetch()} />
      ) : records.length === 0 ? (
        <EmptyState className="py-6" title={`No ${config.entityLabel}s found`} />
      ) : (
        <Card padding="none" className={ROWS}>
          {records.map((r) => (
            <div key={r.id} className={`px-3 py-2.5 flex items-center gap-3 text-sm ${ROW_HOVER}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy dark:text-biscuit truncate">{r.name}</p>
                <p className="text-2xs text-gray-500 dark:text-gray-400 truncate">
                  {r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
                  {config.rowExtra?.(r) ?? ''}
                  {' · '}<TimeAgo value={r.created_at} className="font-mono" />
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>Edit</Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleteMutation.isPending && deleteMutation.variables === r.id}
                  onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMutation.mutate(r.id); }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, accent = 'gray' }: { label: string; value: number | string; accent?: 'gray' | 'brand' }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent === 'brand' ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10' : 'border-gray-200 bg-white dark:border-white/10 dark:bg-night-surface'}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 ${STAT_NUMBER} ${accent === 'brand' ? 'text-brand-700 dark:text-brand-300' : 'text-navy dark:text-biscuit'}`}>{value}</p>
    </div>
  );
}

function bboxLabel(presets: Preset[], bbox: Bbox): string {
  const match = presets.find(
    (p) => p.bbox &&
      Math.abs(p.bbox[0] - bbox[0]) < 0.01 && Math.abs(p.bbox[1] - bbox[1]) < 0.01 &&
      Math.abs(p.bbox[2] - bbox[2]) < 0.01 && Math.abs(p.bbox[3] - bbox[3]) < 0.01,
  );
  if (match) return match.label;
  return `${bbox[0].toFixed(2)}, ${bbox[1].toFixed(2)} → ${bbox[2].toFixed(2)}, ${bbox[3].toFixed(2)}`;
}
