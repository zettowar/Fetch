import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyReports, type NearbyReport } from '../api/lost';
import Map from '../components/Map';
import Button from '../components/ui/Button';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco

export default function LostDogsPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [selectedReport, setSelectedReport] = useState<NearbyReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing' | 'found'>('all');
  const navigate = useNavigate();

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
          {(['all', 'missing', 'found'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'missing' ? 'Missing' : 'Found'}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2">
          This is a community tool, not a replacement for contacting local animal control.
        </p>
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

        {/* Selected report card */}
        {selectedReport && (
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
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600"
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
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      )}
    </div>
  );
}
