import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';
import { apiErrorMessage } from '../../utils/apiError';

type Bbox = [number, number, number, number];
type Tab = 'import' | 'manual';

interface ImportResponse { created: number; updated: number; total_fetched: number; errors: string[] }
interface ImportHistoryEntry {
  id: string; actor_id: string | null; actor_name: string | null;
  created: number; updated: number; total_fetched: number; bbox: Bbox | null; created_at: string;
}
interface VetStats { total: number; by_source: Record<string, number> }
interface VetRecord {
  id: string; name: string; address: string | null; lat: number; lng: number;
  phone: string | null; website: string | null; hours: string | null;
  verified: boolean; created_at: string;
}

const PRESETS: { key: string; label: string; bbox: Bbox | null; note?: string }[] = [
  { key: 'sf', label: 'San Francisco', bbox: [37.70, -122.52, 37.83, -122.35] },
  { key: 'nyc', label: 'New York City', bbox: [40.48, -74.26, 40.92, -73.70] },
  { key: 'la', label: 'Los Angeles', bbox: [33.70, -118.67, 34.34, -118.15] },
  { key: 'us', label: 'United States', bbox: [24.40, -125.00, 49.50, -66.90], note: '~30-60s' },
  { key: 'na', label: 'North America', bbox: [7.20, -168.00, 83.20, -52.00], note: 'US + Canada + Mexico, 60-90s' },
  { key: 'eu', label: 'Europe', bbox: [34.50, -31.50, 71.20, 40.20], note: 'can take 60-90s' },
  { key: 'world', label: 'Worldwide', bbox: null, note: 'slow (90-180s), biggest coverage' },
];

export default function AdminVetsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('import');
  const [selected, setSelected] = useState('sf');

  const { data: stats } = useQuery<VetStats>({
    queryKey: ['admin-vets-stats'],
    queryFn: async () => (await client.get('/admin/vets/stats')).data,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Vet clinic library</h1>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total vets" value={stats?.total ?? '—'} />
        <StatCard label="From OpenStreetMap" value={stats?.by_source?.osm ?? 0} accent="brand" />
        <StatCard label="User-submitted" value={stats?.by_source?.user ?? 0} />
        <StatCard label="Seed / other" value={(stats?.by_source?.seed ?? 0) + (stats?.by_source?.unknown ?? 0)} />
      </section>

      <div className="flex gap-1 mb-5">
        {(['import', 'manual'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t === 'import' ? 'OSM Import' : 'Manual Entries'}
          </button>
        ))}
      </div>

      {tab === 'import' ? (
        <ImportTab selected={selected} setSelected={setSelected} queryClient={queryClient} />
      ) : (
        <ManualVetsTab queryClient={queryClient} />
      )}
    </div>
  );
}

function ImportTab({
  selected,
  setSelected,
  queryClient,
}: {
  selected: string;
  setSelected: (s: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: history = [], isLoading: historyLoading } = useQuery<ImportHistoryEntry[]>({
    queryKey: ['admin-vets-history'],
    queryFn: async () => (await client.get('/admin/vets/import-history')).data,
  });

  const runImport = useMutation<ImportResponse, unknown, Bbox | null>({
    mutationFn: async (bbox) => (await client.post('/admin/vets/import-osm', { bbox })).data,
    onSuccess: (data) => {
      toast.success(`Imported: +${data.created} new, ${data.updated} updated (from ${data.total_fetched})`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['admin-vets-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vets-history'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Import failed')),
  });

  const activePreset = PRESETS.find((p) => p.key === selected)!;

  return (
    <>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Refresh the public vet catalog from OpenStreetMap. Re-runs are safe —
        existing OSM rows are updated in place and user-submitted clinics are never touched.
      </p>
      <section className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Import region</h2>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selected === p.key
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
              {p.note && (
                <span className={`ml-1.5 text-[10px] ${selected === p.key ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                  ({p.note})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Source:{' '}
            <a href="https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dveterinary" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              OSM · amenity=veterinary
            </a>{' '}
            +{' '}
            <a href="https://wiki.openstreetmap.org/wiki/Tag:healthcare%3Dveterinary" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              healthcare=veterinary
            </a>{' '}
            via Overpass API
          </p>
          <Button onClick={() => runImport.mutate(activePreset.bbox)} loading={runImport.isPending}>
            Import {activePreset.label}
          </Button>
        </div>
        {runImport.isPending && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Spinner className="h-3 w-3" />
            Querying Overpass… this can take up to {activePreset.note ?? '60s'}.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Recent imports</h2>
        {historyLoading ? (
          <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No imports yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y">
            {history.map((h) => (
              <div key={h.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{h.bbox ? bboxLabel(h.bbox) : 'Worldwide'}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{h.actor_name ?? 'admin'} · <TimeAgo value={h.created_at} /></p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  <span className="text-green-600 dark:text-green-400">+{h.created}</span>
                  <span>~{h.updated}</span>
                  <span className="text-gray-400 dark:text-gray-500">of {h.total_fetched}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ManualVetsTab({ queryClient }: { queryClient: ReturnType<typeof useQueryClient> }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('user');
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', lat: '', lng: '', phone: '', website: '', hours: '' });

  const { data: records = [], isLoading } = useQuery<VetRecord[]>({
    queryKey: ['admin-vets-list', search, source],
    queryFn: async () => {
      const params = new URLSearchParams({ q: search, limit: '100' });
      if (source) params.set('source', source);
      return (await client.get(`/admin/vets/list?${params}`)).data;
    },
  });

  const resetForm = () => setForm({ name: '', address: '', lat: '', lng: '', phone: '', website: '', hours: '' });

  const createMutation = useMutation({
    mutationFn: () =>
      client.post('/vets', {
        name: form.name,
        address: form.address || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        phone: form.phone || null,
        website: form.website || null,
        hours: form.hours || null,
      }),
    onSuccess: () => {
      toast.success('Vet clinic created');
      queryClient.invalidateQueries({ queryKey: ['admin-vets-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vets-stats'] });
      setShowCreate(false);
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Create failed')),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      client.patch(`/vets/${id}`, {
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        website: form.website || null,
        hours: form.hours || null,
      }),
    onSuccess: () => {
      toast.success('Vet clinic updated');
      queryClient.invalidateQueries({ queryKey: ['admin-vets-list'] });
      setEditId(null);
      resetForm();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Update failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.delete(`/vets/${id}`),
    onSuccess: () => {
      toast.success('Vet clinic deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-vets-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vets-stats'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Delete failed')),
  });

  const startEdit = (r: VetRecord) => {
    setEditId(r.id);
    setShowCreate(false);
    setForm({ name: r.name, address: r.address ?? '', lat: String(r.lat), lng: String(r.lng), phone: r.phone ?? '', website: r.website ?? '', hours: r.hours ?? '' });
  };

  const startCreate = () => { setEditId(null); resetForm(); setShowCreate(true); };
  const cancel = () => { setEditId(null); setShowCreate(false); resetForm(); };
  const isFormValid = form.name.trim() && (editId || (form.lat && form.lng && !isNaN(parseFloat(form.lat)) && !isNaN(parseFloat(form.lng))));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          <option value="user">Manual (user)</option>
          <option value="osm">OSM</option>
        </select>
        <Button size="sm" onClick={startCreate}>+ Add vet</Button>
      </div>

      {(showCreate || editId) && (
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <h3 className="text-sm font-semibold mb-3">{editId ? 'Edit vet clinic' : 'New vet clinic'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Address</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
            {!editId && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Latitude *</label>
                  <input type="number" step="any" placeholder="e.g. 37.7749" value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Longitude *</label>
                  <input type="number" step="any" placeholder="e.g. -122.4194" value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Website</label>
              <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Hours</label>
              <input value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="e.g. Mon–Fri 8am–6pm" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
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
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No vet clinics found.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y">
          {records.map((r) => (
            <div key={r.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{r.name}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
                  {r.phone ? ` · ${r.phone}` : ''}
                  {' · '}<TimeAgo value={r.created_at} />
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>Edit</Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleteMutation.isPending}
                  onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMutation.mutate(r.id); }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent = 'gray' }: { label: string; value: number | string; accent?: 'gray' | 'brand' }) {
  return (
    <div className={`rounded-xl border p-3 ${accent === 'brand' ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${accent === 'brand' ? 'text-brand-700 dark:text-brand-300' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  );
}

function bboxLabel(bbox: Bbox): string {
  const match = PRESETS.find(
    (p) => p.bbox &&
      Math.abs(p.bbox[0] - bbox[0]) < 0.01 && Math.abs(p.bbox[1] - bbox[1]) < 0.01 &&
      Math.abs(p.bbox[2] - bbox[2]) < 0.01 && Math.abs(p.bbox[3] - bbox[3]) < 0.01,
  );
  if (match) return match.label;
  return `${bbox[0].toFixed(2)}, ${bbox[1].toFixed(2)} → ${bbox[2].toFixed(2)}, ${bbox[3].toFixed(2)}`;
}
