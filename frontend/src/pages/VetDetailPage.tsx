import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVet } from '../api/vets';
import BackButton from '../components/ui/BackButton';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import Map from '../components/Map';

const VET_PIN_COLOR = '#0ea5e9';
const VET_PIN_EMERGENCY = '#ef4444';

const ATTRIBUTE_LABELS: Record<string, string> = {
  emergency: 'Emergency services',
  open_24_7: 'Open 24/7',
  house_calls: 'House calls',
  boarding: 'Boarding',
  grooming: 'Grooming',
};

export default function VetDetailPage() {
  const { id } = useParams();
  const { data: vet, isLoading, isError } = useQuery({
    queryKey: ['vet', id],
    queryFn: () => getVet(id!),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (isError || !vet) {
    return (
      <div className="p-6">
        <BackButton fallback="/app/vets" />
        <ErrorState message="Vet clinic not found." />
      </div>
    );
  }

  const isEmergency = !!vet.attributes?.emergency;
  const pinColor = isEmergency ? VET_PIN_EMERGENCY : VET_PIN_COLOR;
  const activeAttributes = vet.attributes
    ? Object.entries(vet.attributes).filter(([, v]) => v)
    : [];

  // Build a Google Maps directions URL from coords; falls back to address.
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${vet.lat},${vet.lng}`;

  return (
    <div className="p-4 pb-8 max-w-xl mx-auto">
      <BackButton fallback="/app/vets" />

      <div className="mt-3 h-48 rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 shadow-soft-sm">
        <Map
          center={[vet.lng, vet.lat]}
          zoom={13}
          markers={[
            {
              id: vet.id,
              lat: vet.lat,
              lng: vet.lng,
              color: pinColor,
              label: vet.name,
            },
          ]}
          className="w-full h-full"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3 mb-1">
        <h1 className="text-2xl font-bold">{vet.name}</h1>
        {vet.verified && (
          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
            Verified
          </span>
        )}
        {isEmergency && (
          <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">
            Emergency
          </span>
        )}
      </div>

      {vet.address && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{vet.address}</p>
      )}

      {/* Contact actions */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {vet.phone && (
          <a
            href={`tel:${vet.phone}`}
            className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-xl transition-colors"
          >
            Call {vet.phone}
          </a>
        )}
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
        >
          Open in Maps
        </a>
        {vet.website && (
          <a
            href={vet.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
          >
            Website
          </a>
        )}
      </div>

      {vet.hours && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Hours
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {vet.hours}
          </p>
        </section>
      )}

      {activeAttributes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Services
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {activeAttributes.map(([key]) => (
              <span
                key={key}
                className="inline-flex items-center px-2.5 py-1 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 text-xs font-medium rounded-full"
              >
                {ATTRIBUTE_LABELS[key] || key}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-[11px] text-center text-gray-400 dark:text-gray-500">
        Vet listings come from OpenStreetMap. Verify hours and emergency
        availability with the clinic before relying on them.
      </p>
    </div>
  );
}
