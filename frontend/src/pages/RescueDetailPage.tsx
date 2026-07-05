import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRescue, getRescueDogs } from '../api/rescues';
import AdoptionInquiryForm from '../components/AdoptionInquiryForm';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import Map from '../components/Map';
import { photoUrl } from '../utils/time';
import type { Dog } from '../types';

const RESCUE_PIN_COLOR = '#8b5cf6'; // shared with the Rescue map page

export default function RescueDetailPage() {
  const { id } = useParams();
  const { data: rescue, isLoading, isError } = useQuery({
    queryKey: ['rescue', id],
    queryFn: () => getRescue(id!),
    enabled: !!id,
    retry: false,
  });
  const { data: dogs = [] } = useQuery<Dog[]>({
    queryKey: ['rescue-dogs', id],
    queryFn: () => getRescueDogs(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (isError || !rescue) {
    return (
      <div className="p-6">
        <BackButton fallback="/app/rescues" />
        <ErrorState message="Rescue not found." />
      </div>
    );
  }

  const hasCoords = rescue.lat != null && rescue.lng != null;

  return (
    <div className="p-4 pb-8 max-w-xl mx-auto">
      <BackButton fallback="/app/rescues" />
      {hasCoords && (
        <div className="mt-3 h-48 rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 shadow-soft-sm">
          <Map
            center={[rescue.lng as number, rescue.lat as number]}
            zoom={12}
            markers={[
              {
                id: rescue.id,
                lat: rescue.lat as number,
                lng: rescue.lng as number,
                color: RESCUE_PIN_COLOR,
                label: rescue.org_name,
              },
            ]}
            className="w-full h-full"
          />
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap mt-3 mb-1">
        <h1 className="text-2xl font-bold">{rescue.org_name}</h1>
        <Badge variant="success">Verified</Badge>
      </div>
      {rescue.location && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{rescue.location}</p>
      )}
      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{rescue.description}</p>

      {(rescue.website || rescue.donation_url) && (
        <div className="flex items-center gap-2 mt-4">
          {rescue.donation_url && (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-xl transition-colors"
            >
              Donate
            </a>
          )}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
            >
              Visit website
            </a>
          )}
        </div>
      )}

      <h2 className="text-lg font-semibold mt-8 mb-3">
        Adoptable dogs ({dogs.length})
      </h2>
      {dogs.length === 0 ? (
        <EmptyState
          illustration="sleeping"
          title="No dogs available right now"
          body="Check back soon."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {dogs.map((d) => (
            <Link
              key={d.id}
              to={`/app/dogs/${d.id}`}
              className="block rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-soft-sm hover:shadow-soft hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 ease-soft-out"
            >
              {d.primary_photo_url ? (
                <img
                  src={d.primary_photo_url}
                  alt={d.name}
                  className="w-full aspect-square object-cover"
                />
              ) : d.photos?.[0] ? (
                <img
                  src={photoUrl(d.photos[0])}
                  alt={d.name}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-brand-50 flex items-center justify-center text-3xl">
                  🐕
                </div>
              )}
              <div className="p-2.5">
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{d.name}</p>
                {d.breed_display && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{d.breed_display}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <AdoptionInquiryForm
          rescueId={rescue.id}
          rescueName={rescue.org_name}
          dogs={dogs.filter((d) => !d.adopted_at && d.is_active)}
        />
      </div>
    </div>
  );
}
