import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyReports, getMySubscription, type NearbyReport } from '../api/lost';
import Map, { MAP_PIN } from '../components/Map';
import Badge from '../components/ui/Badge';
import BrandIcon from '../components/brand/BrandIcon';
import PawSpinner from '../components/flair/PawSpinner';
import TimeAgo from '../components/TimeAgo';
import ErrorState from '../components/ui/ErrorState';
import LostAlertSubscription from '../components/LostAlertSubscription';
import { DEFAULT_MAP_CENTER, useUserLocation } from '../utils/useUserLocation';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const LAST_VISITED_KEY = 'lost-last-visited';

type Kind = 'all' | 'missing' | 'found';

export default function LostPetsPage() {
  useDocumentTitle('Lost & Found · Fetchpawz');
  const initialCenter = useUserLocation(DEFAULT_MAP_CENTER);
  const [viewCenter, setViewCenter] = useState<[number, number]>(initialCenter);
  const [selectedReport, setSelectedReport] = useState<NearbyReport | null>(null);
  const [filter, setFilter] = useState<Kind>('all');
  const [newCount, setNewCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const lastVisitedRef = useRef<string | null>(localStorage.getItem(LAST_VISITED_KEY));
  const navigate = useNavigate();

  // Re-center the query when the user-location hook resolves a real fix.
  useEffect(() => {
    setViewCenter(initialCenter);
  }, [initialCenter]);

  const { data: subscription } = useQuery({
    queryKey: ['lost-subscription'],
    queryFn: getMySubscription,
    retry: false,
  });

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['lost-nearby', viewCenter[1], viewCenter[0], filter],
    queryFn: () =>
      getNearbyReports(
        viewCenter[1],
        viewCenter[0],
        25,
        filter === 'all' ? undefined : filter,
      ),
    // Keep the last result on screen while the next centre loads. The key is
    // the exact map centre, so without this every pan was a brand-new query
    // with no data: the pins vanished (and any open popup closed) until the
    // response for the new position arrived.
    placeholderData: keepPreviousData,
  });

  const { data: allReports = [], isError: countsFailed } = useQuery({
    queryKey: ['lost-nearby', viewCenter[1], viewCenter[0], 'all'],
    queryFn: () => getNearbyReports(viewCenter[1], viewCenter[0], 25),
    placeholderData: keepPreviousData, // see the pins query above
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
    // Missing = the navy pin with an orange dot (the missing badge, drawn
    // on a map); found = Off-Leash Green. Never danger red.
    color: r.kind === 'missing' ? MAP_PIN.ink : MAP_PIN.park,
    dot: r.kind === 'missing' ? MAP_PIN.play : MAP_PIN.paper,
    label: `${r.kind === 'missing' ? 'Missing' : 'Found'}: ${r.pet_name || 'Unknown pet'}`,
    onClick: () => setSelectedReport(r),
    popup: (
      <ReportPopup
        report={r}
        onView={() => navigate(`/app/lost/${r.id}`)}
      />
    ),
  }));

  const filterMeta: Record<Kind, { label: string; emptyMsg: string }> = {
    all: { label: 'All', emptyMsg: 'No reports in this area yet.' },
    missing: { label: 'Missing', emptyMsg: 'No missing pets reported here — good news.' },
    found: { label: 'Found', emptyMsg: 'No found pets reported here yet.' },
  };

  return (
    // Phone: header, map, list, footer stacked. From `md` the list column
    // (header, list, footer) sits beside a full-height map — the wrapper
    // around map + list turns into `contents` so both join the grid.
    <div className="flex flex-col flex-1 min-h-0 md:grid md:grid-cols-[360px_minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)_auto]">
      {/* ── Compact header ──────────────────────────────────────────── */}
      {/* The calm register: plain Figtree title, flat surfaces, no red. */}
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface md:col-start-1 md:row-start-1 md:border-r md:px-5 md:pt-4">
        <h1 className="font-plain text-xl leading-tight text-navy dark:text-biscuit flex items-center gap-2">
          <BrandIcon name="lost" size={20} /> Lost &amp; Found
        </h1>

        <div className="mt-2.5 overflow-x-auto -mx-4 px-4 pb-0.5">
          <div className="seg">
            {(['all', 'missing', 'found'] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className="flex-shrink-0"
                >
                  {filterMeta[f].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Link to="/app/lost/report-missing" className="btn btn-primary btn-sm">
            <BrandIcon name="lost" size={18} className="[--bean:var(--ink)]" /> Report missing
          </Link>
          <Link to="/app/lost/report-found" className="btn btn-park btn-sm">
            <BrandIcon name="eye" size={18} className="[--bean:var(--ink)]" /> Report found
          </Link>
        </div>

        {newCount > 0 && !bannerDismissed && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-navy/15 bg-navy-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-night-raised">
            <span className="font-bold text-navy dark:text-biscuit">
              {newCount} new report{newCount !== 1 ? 's' : ''} since your last visit
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-2 text-xs font-bold text-gray-600 underline underline-offset-2 hover:text-navy dark:text-gray-300 dark:hover:text-biscuit"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 md:contents">
        <div className="h-[62%] min-h-[280px] relative md:h-auto md:min-h-0 md:col-start-2 md:row-start-1 md:row-span-3">
        <Map
          center={initialCenter}
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
                    // The search area: orange around a missing pet, green around a found one.
                    color: selectedReport.kind === 'missing' ? MAP_PIN.play : MAP_PIN.park,
                    fillOpacity: 0.15,
                  },
                ]
              : []
          }
          showLocateMe
          selectedMarkerId={selectedReport?.id ?? null}
          onPopupClose={() => setSelectedReport(null)}
          onViewChange={(lat, lng) => setViewCenter([lng, lat])}
          className="w-full h-full"
        />

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1.5 text-xs font-bold text-navy backdrop-blur dark:border-white/10 dark:bg-night-surface/95 dark:text-biscuit z-10">
          <span className="flex items-center gap-1.5">
            <MissingSwatch />
            Missing
          </span>
          <span className="flex items-center gap-1.5">
            <FoundSwatch />
            Found
          </span>
        </div>

        {/* Empty state — only when not loading and no results for the filter */}
        {!isLoading && reports.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 text-center text-sm font-semibold text-gray-700 backdrop-blur dark:border-white/10 dark:bg-night-surface/95 dark:text-gray-200 max-w-[90%] z-10">
            {filterMeta[filter].emptyMsg}
          </div>
        )}

        {/* Loading indicator confined to the map area */}
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-full border border-gray-200 px-4 py-2 dark:border-white/10">
            <PawSpinner size="sm" />
          </div>
        )}
        </div>

        {/* Recent reports strip — keeps the area below the (smaller) map useful */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-biscuit dark:bg-night border-t border-gray-200 dark:border-white/10 md:col-start-1 md:row-start-2 md:border-t-0 md:border-r">
          {isError ? (
            // Never fall through to "no missing pets reported here — good
            // news" when the query actually failed: on this screen a false
            // all-clear is the worst thing we can show.
            <ErrorState
              message="Couldn't load nearby reports"
              onRetry={() => refetch()}
            />
          ) : reports.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 text-center">
              {filterMeta[filter].emptyMsg}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-white/10">
              {/* Six fit under the phone's map; the side column has room for the rest. */}
              {reports.slice(0, 50).map((r, i) => {
                const isMissing = r.kind === 'missing';
                return (
                  <li key={r.id} className={i >= 6 ? 'hidden md:block' : undefined}>
                    <Link
                      to={`/app/lost/${r.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-night-surface transition-colors"
                      onMouseEnter={() => setSelectedReport(r)}
                    >
                      {isMissing ? <MissingSwatch /> : <FoundSwatch />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-navy dark:text-biscuit truncate">
                          {r.pet_name || (isMissing ? 'Missing pet' : 'Found pet')}
                        </p>
                        <p className="text-2xs text-gray-500 dark:text-gray-400">
                          {isMissing ? 'Missing' : 'Found'} · <TimeAgo value={r.created_at} />
                        </p>
                      </div>
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">View</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-white/10 bg-white dark:bg-night-surface md:col-start-1 md:row-start-3 md:border-r">
        <LostAlertSubscription center={viewCenter} />
        <div className="px-4 py-2 flex items-center justify-around text-xs text-gray-600 dark:text-gray-300">
          {/* A dash, not a zero: "0 missing" when the request failed reads as
              an all-clear we have not actually verified. */}
          <span><span className="font-extrabold text-navy dark:text-biscuit">{countsFailed ? '—' : counts.all}</span> total</span>
          <span aria-hidden className="text-gray-300 dark:text-gray-600">·</span>
          <span><span className="font-extrabold text-navy dark:text-biscuit">{countsFailed ? '—' : counts.missing}</span> missing</span>
          <span aria-hidden className="text-gray-300 dark:text-gray-600">·</span>
          <span><span className="font-extrabold text-green-700 dark:text-green-400">{countsFailed ? '—' : counts.found}</span> found</span>
        </div>
        <p className="px-4 pb-2 text-2xs text-center text-gray-500 dark:text-gray-400">
          A community tool — please also contact your local animal control.
        </p>
      </div>
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
        {report.pet_photo_url ? (
          <img
            src={report.pet_photo_url}
            alt={report.pet_name ?? 'Pet'}
            className="h-14 w-14 flex-shrink-0 rounded-lg border border-gray-200 object-cover dark:border-white/10"
          />
        ) : (
          <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-100 dark:bg-night-raised flex items-center justify-center text-gray-500 dark:text-gray-400">
            <BrandIcon name="lost" size={26} className="[--bean:currentColor]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isMissing ? (
              <Badge variant="missing">Missing</Badge>
            ) : (
              <Badge variant="success">Found</Badge>
            )}
            {isFresh && (
              <Badge
                variant="warning"
                icon={
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning-500" />
                  </span>
                }
              >
                Fresh
              </Badge>
            )}
          </div>
          <p className="mt-1 text-base font-extrabold text-navy dark:text-biscuit truncate leading-tight">
            {report.pet_name || 'Unknown pet'}
          </p>
          {report.pet_breed && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{report.pet_breed}</p>
          )}
          <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
            <TimeAgo value={report.created_at} />
          </p>
        </div>
      </div>

      {report.description && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{report.description}</p>
      )}

      <button
        type="button"
        onClick={onView}
        className="btn btn-secondary btn-sm mt-3 w-full"
      >
        View details
      </button>
    </div>
  );
}

// ── Legend / list swatches — the pins in miniature ───────────────────

function MissingSwatch() {
  return (
    <span
      aria-hidden
      className="inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border border-navy bg-navy dark:border-biscuit/60"
    >
      <span className="h-1 w-1 rounded-full bg-brand-500" />
    </span>
  );
}

function FoundSwatch() {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-navy bg-green-500 dark:border-biscuit/60"
    />
  );
}
