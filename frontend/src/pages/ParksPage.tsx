import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getNearbyParks, type Park } from '../api/parks';
import Map from '../components/Map';
import Button from '../components/ui/Button';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

export default function ParksPage() {
  const [center] = useState(DEFAULT_CENTER);
  const navigate = useNavigate();

  const { data: parks = [], isLoading } = useQuery({
    queryKey: ['parks-nearby', center[1], center[0]],
    queryFn: () => getNearbyParks(center[1], center[0], 25),
  });

  const markers = parks.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    color: p.verified ? '#22c55e' : '#9ca3af',
    label: p.name,
    onClick: () => navigate(`/parks/${p.id}`),
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dog Parks</h1>
          <Link to="/parks/new">
            <Button size="sm">Add Park</Button>
          </Link>
        </div>
      </div>

      <div className="flex-1">
        <Map center={center} zoom={12} markers={markers} className="w-full h-1/2" />

        <div className="p-4 overflow-y-auto h-1/2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" />
            </div>
          ) : parks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {parks.map((park) => (
                <Link
                  key={park.id}
                  to={`/parks/${park.id}`}
                  className="p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{park.name}</h3>
                      {park.address && <p className="text-xs text-gray-500">{park.address}</p>}
                    </div>
                    <div className="text-right">
                      {park.avg_rating ? (
                        <p className="font-semibold text-brand-600">{park.avg_rating}/5</p>
                      ) : (
                        <p className="text-xs text-gray-400">No reviews</p>
                      )}
                      <p className="text-xs text-gray-400">{park.review_count} reviews</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No parks found nearby.</p>
          )}
        </div>
      </div>
    </div>
  );
}
