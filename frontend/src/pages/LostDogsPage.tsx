import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyReports, getMySubscription, type NearbyReport } from '../api/lost';
import Map from '../components/Map';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Skeleton';
import TimeAgo from '../components/TimeAgo';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco
const LAST_VISITED_KEY = 'lost-last-visited';

export default function LostDogsPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [selectedReport, setSelectedReport] = useState<NearbyReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing' | 'found'>('all');
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

  const markers = reports.map((r) => ({
    id: r.id,
    lat: r.fuzzed_lat,
    lng: r.fuzzed_lng,
    color: r.kind === 'missing' ? '#ef4444' : '#3b82f6',
    label: `${r.kind === 'missing' ? 'Missing' : 'Found'}: ${r.dog_name || 'Unknown dog'}`,
    onClick: () => setSelectedReport(r),
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Lost & Found Dogs</h1>
          <div className="flex gap-2">
            <Link to="/lost/report-missing">
              <Button size="sm" variant="danger">Report Missing</Button>
            </Link>
            <Link to="/lost/report-found">
              <Button size="sm">Report Found</Button>
            </Link>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'missing', 'found'] as const).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[11px] font-semibold ${
                    active
                      ? 'bg-white/25 text-white'
                      : 'bg-white text-gray-500'
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          This is a community tool, not a replacement for contacting local animal control.
        </p>

        {newCount > 0 && !bannerDismissed && (
          <div className="mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-amber-800 font-medium">
              {newCount} new report{newCount !== 1 ? 's' : ''} near you since your last visit
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-amber-500 hover:text-amber-700 ml-2 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          center={center}
          zoom={12}
          markers={markers}
          className="w-full h-full"
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-2 text-xs flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Missing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Found
          </span>
        </div>

        {/* Empty state when the current filter yields no reports */}
        {!isLoading && reports.length === 0 && !selectedReport && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-xl shadow-md px-4 py-2 text-sm text-gray-600 max-w-[90%] text-center">
            {filter === 'found'
              ? 'No found dogs reported in this area yet.'
              : filter === 'missing'
              ? 'No missing dogs reported in this area — good news!'
              : 'No reports in this area yet.'}
          </div>
        )}

        {/* Selected report card */}
        {selectedReport && (() => {
          const ageMs = Date.now() - new Date(selectedReport.created_at).getTime();
          const isFresh = selectedReport.kind === 'missing' && ageMs < 6 * 60 * 60 * 1000;
          const isMissing = selectedReport.kind === 'missing';
          return (
          <div className="absolute bottom-4 right-4 left-4 sm:left-auto sm:w-72 bg-white rounded-xl shadow-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <span
                  className={`text-xs font-bold uppercase ${
                    selectedReport.kind === 'missing' ? 'text-red-500' : 'text-blue-500'
                  }`}
                >
                  {selectedReport.kind}
                </span>
                <h3 className="font-semibold">{selectedReport.dog_name || 'Unknown'}</h3>
                {selectedReport.dog_breed && (
                  <p className="text-sm text-gray-500">{selectedReport.dog_breed}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isMissing
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {isMissing ? 'Missing' : 'Found'} <TimeAgo value={selectedReport.created_at} />
                  </span>
                  {isFresh && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-medium rounded-full">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                      Fresh
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close report details"
              >
                x
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {selectedReport.description}
            </p>
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => navigate(`/lost/${selectedReport.id}`)}
            >
              View Details
            </Button>
          </div>
          );
        })()}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Spinner />
        </div>
      )}
    </div>
  );
}
