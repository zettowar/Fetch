import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Skeleton';
import TimeAgo from '../../components/TimeAgo';
import { apiErrorMessage } from '../../utils/apiError';

type Bbox = [number, number, number, number];

interface ImportResponse {
  created: number;
  updated: number;
  total_fetched: number;
  errors: string[];
}
interface ImportHistoryEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  created: number;
  updated: number;
  total_fetched: number;
  bbox: Bbox | null;
  created_at: string;
}
interface ParkStats {
  total: number;
  by_source: Record<string, number>;
}

// Preset bboxes for common regions. `null` means worldwide.
// (south, west, north, east)
const PRESETS: { key: string; label: string; bbox: Bbox | null; note?: string }[] = [
  { key: 'sf', label: 'San Francisco', bbox: [37.70, -122.52, 37.83, -122.35] },
  { key: 'nyc', label: 'New York City', bbox: [40.48, -74.26, 40.92, -73.70] },
  { key: 'la', label: 'Los Angeles', bbox: [33.70, -118.67, 34.34, -118.15] },
  { key: 'us', label: 'United States', bbox: [24.40, -125.00, 49.50, -66.90], note: '~15-30s' },
  { key: 'eu', label: 'Europe', bbox: [34.50, -31.50, 71.20, 40.20], note: 'can take 30-60s' },
  { key: 'world', label: 'Worldwide', bbox: null, note: 'slow (60-120s), biggest coverage' },
];

export default function AdminParksPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>('sf');

  const { data: stats } = useQuery<ParkStats>({
    queryKey: ['admin-parks-stats'],
    queryFn: async () => (await client.get('/admin/parks/stats')).data,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<ImportHistoryEntry[]>({
    queryKey: ['admin-parks-history'],
    queryFn: async () => (await client.get('/admin/parks/import-history')).data,
  });

  const runImport = useMutation<ImportResponse, unknown, Bbox | null>({
    mutationFn: async (bbox) => {
      const res = await client.post('/admin/parks/import-osm', { bbox });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Imported: +${data.created} new, ${data.updated} updated (from ${data.total_fetched})`,
        { duration: 5000 },
      );
      queryClient.invalidateQueries({ queryKey: ['admin-parks-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parks-history'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Import failed')),
  });

  const activePreset = PRESETS.find((p) => p.key === selected)!;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dog parks library</h1>
      <p className="text-sm text-gray-500 mb-5">
        Refresh the public parks catalog from OpenStreetMap. Re-runs are safe —
        existing OSM rows are updated in place and user-submitted parks are
        never touched.
      </p>

      {/* Source breakdown */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total parks" value={stats?.total ?? '—'} />
        <StatCard label="From OpenStreetMap" value={stats?.by_source?.osm ?? 0} accent="brand" />
        <StatCard label="User-submitted" value={stats?.by_source?.user ?? 0} />
        <StatCard label="Seed / other" value={(stats?.by_source?.seed ?? 0) + (stats?.by_source?.unknown ?? 0)} />
      </section>

      {/* Region picker + run button */}
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Import region</h2>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selected === p.key
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
              {p.note && (
                <span className={`ml-1.5 text-[10px] ${selected === p.key ? 'text-white/80' : 'text-gray-400'}`}>
                  ({p.note})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            Source:{' '}
            <a
              href="https://wiki.openstreetmap.org/wiki/Tag:leisure%3Ddog_park"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline"
            >
              OSM · leisure=dog_park
            </a>{' '}
            via Overpass API
          </p>
          <Button
            onClick={() => runImport.mutate(activePreset.bbox)}
            loading={runImport.isPending}
          >
            Import {activePreset.label}
          </Button>
        </div>

        {runImport.isPending && (
          <p className="mt-3 text-xs text-gray-500 flex items-center gap-2">
            <Spinner className="h-3 w-3" />
            Querying Overpass… this can take up to {activePreset.note ?? '30s'}.
          </p>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent imports</h2>
        {historyLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No imports yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white divide-y">
            {history.map((h) => (
              <div key={h.id} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">
                    {h.bbox ? bboxLabel(h.bbox) : 'Worldwide'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {h.actor_name ?? 'admin'} · <TimeAgo value={h.created_at} />
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                  <span className="text-green-600">+{h.created}</span>
                  <span className="text-gray-500">~{h.updated}</span>
                  <span className="text-gray-400">of {h.total_fetched}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = 'gray',
}: {
  label: string;
  value: number | string;
  accent?: 'gray' | 'brand';
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent === 'brand'
          ? 'border-brand-200 bg-brand-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${accent === 'brand' ? 'text-brand-700' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function bboxLabel(bbox: Bbox): string {
  // Try to match it back to a preset; fall back to raw numbers.
  const match = PRESETS.find(
    (p) =>
      p.bbox &&
      Math.abs(p.bbox[0] - bbox[0]) < 0.01 &&
      Math.abs(p.bbox[1] - bbox[1]) < 0.01 &&
      Math.abs(p.bbox[2] - bbox[2]) < 0.01 &&
      Math.abs(p.bbox[3] - bbox[3]) < 0.01,
  );
  if (match) return match.label;
  return `${bbox[0].toFixed(2)}, ${bbox[1].toFixed(2)} → ${bbox[2].toFixed(2)}, ${bbox[3].toFixed(2)}`;
}
