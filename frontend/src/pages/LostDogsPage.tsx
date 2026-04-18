import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyReports, getMySubscription, type NearbyReport } from '../api/lost';
import Map from '../components/Map';
import { Spinner } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco
const LAST_VISITED_KEY = 'lost-last-visited';

type Kind = 'all' | 'missing' | 'found';

export default function LostDogsPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [selectedReport, setSelectedReport] = useState<NearbyReport | null>(null);
  const [filter, setFilter] = useState<Kind>('all');
  const [newCount, setNewCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const lastVisitedRef = useRef<string | null>(localStorage.getItem(LAST_VISITED_KEY));
  const navigate = useNavigate();

  const { data: subscription } = useQuery({
    queryKey: ['lost-subscription'],
    queryFn: getMySubscription,
    retry: false,
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['lost-nearby', center[1], center[0], filter],
    queryFn: () =>
      getNearbyReports(
        center[1],
        center[0],
        25,
        filter === 'all' ? undefined : filter,
      ),
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['lost-nearby', center[1], center[0], 'all'],
    queryFn: () => getNearbyReports(center[1], center[0], 25),
  });

  const counts = {
    all: allReports.length,
    missing: allReports.filter((r) => r.kind === 'missing').length,
    found: allReports.filter((r) => r.kind === 'found').length,
  };

  useEffect(() => {
    if (!subscription?.enabled || !reports.length) return;
    const lastVisited = lastVisitedRef.current;
    if (lastVisited) {
      const count = reports.filter((r) => r.created_at > lastVisited).length;
      if (count > 0) setNewCount(count);
    }
    const now = new Date().toISOString();
    localStorage.setItem(LAST_VISITED_KEY, now);
    lastVisitedRef.current = now;
  }, [subscription, reports]);

  // Drop a stale selection if the filter hides it.
  useEffect(() => {
    if (!selectedReport) return;
    if (!reports.find((r) => r.id === selectedReport.id)) {
      setSelectedReport(null);
    }
  }, [reports, selectedReport]);

  const markers = reports.map((r) => ({
    id: r.id,
    lat: r.fuzzed_lat,
    lng: r.fuzzed_lng,
    color: r.kind === 'missing' ? '#ef4444' : '#3b82f6',
    label: `${r.kind === 'missing' ? 'Missing' : 'Found'}: ${r.dog_name || 'Unknown dog'}`,
    onClick: () => setSelectedReport(r),
    popup: (
      <ReportPopup
        report={r}
        onView={() => navigate(`/lost/${r.id}`)}
      />
    ),
  }));

  const filterMeta: Record<Kind, { label: string; emptyMsg: string }> = {
    all: { label: 'All', emptyMsg: 'No reports in this area yet.' },
    missing: { label: 'Missing', emptyMsg: 'No missing dogs reported here — good news.' },
    found: { label: 'Found', emptyMsg: 'No found dogs reported here yet.' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* ── Compact header ──────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-white">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Lost &amp; Found</h1>
          <span className="text-xs text-gray-400">
            {reports.length} report{reports.length === 1 ? '' : 's'} nearby
          </span>
        </div>

        <div className="flex gap-1.5 mt-2.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          {(['all', 'missing', 'found'] as const).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filterMeta[f].label}
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                    active ? 'bg-white/25 text-white' : 'bg-white text-gray-500'
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {newCount > 0 && !bannerDismissed && (
          <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-amber-800 font-medium">
              {newCount} new report{newCount !== 1 ? 's' : ''} since your last visit
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-amber-500 hover:text-amber-700 ml-2 text-xs"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <Map
          center={center}
          zoom={12}
          markers={markers}
          circles={
            selectedReport
              ? [
                  {
                    id: `${selectedReport.id}-area`,
                    lat: selectedReport.fuzzed_lat,
                    lng: selectedReport.fuzzed_lng,
                    radiusMeters: selectedReport.location_fuzz_m ?? 500,
                    color: selectedReport.kind === 'missing' ? '#ef4444' : '#3b82f6',
                    fillOpacity: 0.15,
                  },
                ]
              : []
          }
          fitMarkers
          showLocateMe
          selectedMarkerId={selectedReport?.id ?? null}
          onPopupClose={() => setSelectedReport(null)}
          className="w-full h-full"
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex gap-3 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs shadow-md ring-1 ring-black/5 backdrop-blur z-10">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            Missing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Found
          </span>
        </div>

        {/* Report FAB cluster (bottom-right). Lives on top of the map so
            primary actions are one tap away while you're browsing pins. */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
          <Link
            to="/lost/report-missing"
            className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all"
          >
            <span aria-hidden>🚨</span> Missing
          </Link>
          <Link
            to="/lost/report-found"
            className="flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-95 transition-all"
          >
            <span aria-hidden>🐾</span> Found
          </Link>
        </div>

        {/* Empty state — only when not loading and no results for the filter */}
        {!isLoading && reports.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-xl shadow-md px-4 py-2 text-sm text-gray-600 max-w-[90%] text-center z-10">
            {filterMeta[filter].emptyMsg}
          </div>
        )}

        {/* Loading spinner confined to the map area */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm z-20">
            <Spinner />
          </div>
        )}
      </div>

      <p className="px-4 py-2 text-[11px] text-center text-gray-400 border-t border-gray-100 bg-white">
        A community tool — please also contact your local animal control.
      </p>
    </div>
  );
}

// ── Popup content rendered inside the MapLibre popup ─────────────────

function ReportPopup({
  report,
  onView,
}: {
  report: NearbyReport;
  onView: () => void;
}) {
  const isMissing = report.kind === 'missing';
  const ageMs = Date.now() - new Date(report.created_at).getTime();
  const isFresh = isMissing && ageMs < 6 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col">
      {/* Header strip: photo (if any) + title block */}
      <div className="flex gap-3">
        {report.dog_photo_url ? (
          <img
            src={report.dog_photo_url}
            alt={report.dog_name ?? 'Dog'}
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
            🐕
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide ${
                isMissing ? 'text-red-500' : 'text-blue-500'
              }`}
            >
              {report.kind}
            </span>
            {isFresh && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                </span>
                Fresh
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 truncate leading-tight">
            {report.dog_name || 'Unknown dog'}
          </p>
          {report.dog_breed && (
            <p className="text-xs text-gray-500 truncate">{report.dog_breed}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-0.5">
            <TimeAgo value={report.created_at} />
          </p>
        </div>
      </div>

      {report.description && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{report.description}</p>
      )}

      <button
        type="button"
        onClick={onView}
        className="mt-3 w-full rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-2 transition-colors"
      >
        View details
      </button>
    </div>
  );
}
