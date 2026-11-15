import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVet } from '../api/vets';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import Map, { MAP_PIN } from '../components/Map';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Same pins as the Vets map: neutral navy, Ball Orange for emergency.
const VET_PIN_COLOR = MAP_PIN.ink;
const VET_PIN_EMERGENCY = MAP_PIN.play;

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
  useDocumentTitle(`${vet?.name ?? 'Vet'} · Fetchpawz`);

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
        <ErrorState message="Vet clinic not found." hint={NOT_FOUND_HINT} />
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

      <div className="mt-3 h-48 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
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
          cooperative
          className="w-full h-full"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-4 mb-1.5">
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit text-balance">{vet.name}</h1>
        {vet.verified && <Badge variant="success">Verified</Badge>}
        {isEmergency && <Badge variant="brand">Emergency</Badge>}
      </div>

      {vet.address && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{vet.address}</p>
      )}

      {/* Contact actions */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {vet.phone && (
          <a
            href={`tel:${vet.phone}`}
            className="btn btn-primary btn-sm"
          >
            Call {vet.phone}
          </a>
        )}
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          Open in Maps
        </a>
        {vet.website && (
          <a
            href={vet.website}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Website
          </a>
        )}
      </div>

      {vet.hours && (
        <section className="mt-6">
          <h2 className="eyebrow mb-2">
            Hours
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">
            {vet.hours}
          </p>
        </section>
      )}

      {activeAttributes.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow mb-2">
            Services
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {activeAttributes.map(([key]) => (
              <Badge key={key} variant="info" size="md">
                {ATTRIBUTE_LABELS[key] || key}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-2xs text-center text-gray-500 dark:text-gray-400">
        Vet listings come from OpenStreetMap. Verify hours and emergency
        availability with the clinic before relying on them.
      </p>
    </div>
  );
}
