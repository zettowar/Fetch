import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyParks } from '../api/parks';
import Map from '../components/Map';
import Button from '../components/ui/Button';
import { Spinner } from '../components/ui/Skeleton';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

export default function ParksPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'verified'>('all');
  const navigate = useNavigate();

  const { data: parks = [], isLoading, isError } = useQuery({
    queryKey: ['parks-nearby', center[1], center[0]],
    queryFn: () => getNearbyParks(center[1], center[0], 25),
  });

  const searchLower = search.trim().toLowerCase();
  const filteredParks = parks.filter((p) => {
    if (filter === 'active' && p.active_dogs_count <= 0) return false;
    if (filter === 'verified' && !p.verified) return false;
    if (searchLower) {
      const name = p.name.toLowerCase();
      const addr = (p.address || '').toLowerCase();
      if (!name.includes(searchLower) && !addr.includes(searchLower)) return false;
    }
    return true;
  });

  const markers = filteredParks.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    color: p.active_dogs_count > 0 ? '#f97316' : p.verified ? '#22c55e' : '#9ca3af',
    label: p.name,
    onClick: () => navigate(`/parks/${p.id}`),
  }));

  const filterOptions: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active now' },
    { key: 'verified', label: 'Verified' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dog Parks</h1>
          <Link to="/parks/new">
            <Button size="sm">Add Park</Button>
          </Link>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parks..."
          className="mt-3 bg-gray-100 rounded-full px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <div className="flex gap-2 mt-2">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === opt.key
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <Map center={center} zoom={12} markers={markers} className="w-full h-1/2" />

        <div className="p-4 overflow-y-auto h-1/2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-6 w-6" />
            </div>
          ) : isError ? (
            <p className="text-red-500 text-sm text-center py-4">Failed to load parks. Check your connection.</p>
          ) : filteredParks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {filteredParks.map((park) => (
                <Link
                  key={park.id}
                  to={`/parks/${park.id}`}
                  className="p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{park.name}</h3>
                        {park.active_dogs_count > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[11px] font-medium rounded-full">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                            </span>
                            {park.active_dogs_count} here now
                          </span>
                        )}
                      </div>
                      {park.address && <p className="text-xs text-gray-500">{park.address}</p>}
                    </div>
                    <div className="text-right">
                      {park.avg_rating ? (
                        <>
                          <p className="text-sm text-yellow-400 tracking-tight leading-none">
                            {'★'.repeat(Math.round(park.avg_rating))}{'☆'.repeat(5 - Math.round(park.avg_rating))}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{park.avg_rating.toFixed(1)} · {park.review_count} reviews</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">No reviews yet</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : parks.length > 0 ? (
            <p className="text-gray-500 text-center py-4">No parks match your search.</p>
          ) : (
            <p className="text-gray-500 text-center py-4">No parks found nearby.</p>
          )}
        </div>
      </div>
    </div>
  );
}
