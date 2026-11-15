import type { CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRescue, getRescueDogs } from '../api/rescues';
import AdoptionInquiryForm from '../components/AdoptionInquiryForm';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import { isNotFound } from '../utils/apiError';
import Map from '../components/Map';
import { useSectionOpen } from '../hooks/usePublicFlags';
import { photoUrl } from '../utils/time';
import type { Pet } from '../types';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const RESCUE_PIN_COLOR = '#FF5C93'; // Forever Pink, shared with the Rescue map page

export default function RescueDetailPage() {
  const { id } = useParams();
  // In-app checkout only exists while the Donate section is switched on;
  // with it off, fall back to the rescue's own donation page (or no button).
  const donateOpen = useSectionOpen('explore_donate_enabled');
  const { data: rescue, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['rescue', id],
    queryFn: () => getRescue(id!),
    enabled: !!id,
    retry: false,
  });
  useDocumentTitle(`${rescue?.org_name ?? 'Rescue'} · Fetchpawz`);
  const { data: pets = [] } = useQuery<Pet[]>({
    queryKey: ['rescue-pets', id],
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
    // A 404 is a definitive answer; anything else is a failed load the
    // person can retry — don't call a server hiccup "not found".
    const missing = !isError || isNotFound(error);
    return (
      <div className="p-6">
        <BackButton fallback="/app/rescues" />
        {missing ? (
          <ErrorState message="Rescue not found." hint={NOT_FOUND_HINT} />
        ) : (
          <ErrorState message="Couldn't load this rescue." onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  const hasCoords = rescue.lat != null && rescue.lng != null;

  return (
    <div className="p-4 pb-8 max-w-xl mx-auto">
      <BackButton fallback="/app/rescues" />
      {hasCoords && (
        <div className="mt-3 h-48 rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
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
            cooperative
            className="w-full h-full"
          />
        </div>
      )}
      {/* No pin to show: the cover is Forever Pink with the toy box inside it,
          and the logo tile sits on its bottom edge. */}
      {!hasCoords && (
        <div className="toybox-pink mt-3 h-28 rounded-3xl border-[2.5px] border-navy bg-pink-500 dark:border-white/15" aria-hidden />
      )}
      <div className={`flex mb-3 ${hasCoords ? 'mt-4 items-center gap-3' : '-mt-8 flex-col items-start gap-2.5'}`}>
        {/* The rescue's logo tile: Forever Pink leads on rescue surfaces. */}
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-navy bg-pink-500 text-navy shadow-toy-sm dark:border-white/15 ${hasCoords ? '' : 'ml-4 ring-4 ring-biscuit dark:ring-night'}`}
          aria-hidden
        >
          {rescue.logo_url ? (
            <img src={rescue.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandIcon name="rescue" size={32} style={{ '--bean': 'var(--paper)' } as CSSProperties} />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="text-[28px] leading-none text-navy dark:text-biscuit text-balance">{rescue.org_name}</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <Badge variant="success" icon={<BrandIcon name="shield" size={12} />}>
              Verified
            </Badge>
            {rescue.location && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{rescue.location}</span>
            )}
          </div>
        </div>
      </div>
      <p className="text-[15px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{rescue.description}</p>

      {(rescue.website || rescue.donation_url || (rescue.donations_enabled && donateOpen)) && (
        <div className="flex items-center gap-2 mt-4">
          {rescue.donations_enabled && donateOpen ? (
            // Connect-enabled: in-app Stripe checkout, preselected on Donate.
            <Link to={`/app/donate?rescue=${rescue.id}`} className="btn btn-rescue">
              Donate
            </Link>
          ) : rescue.donation_url ? (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-rescue"
            >
              Donate
            </a>
          ) : null}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Visit website
            </a>
          )}
        </div>
      )}

      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mt-8 mb-3">
        Adoptable pets ({pets.length})
      </h2>
      {pets.length === 0 ? (
        <EmptyState
          illustration="sleeping"
          title="No pets available right now"
          body="Check back soon."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pets.map((d) => (
            <Link
              key={d.id}
              to={`/app/pets/${d.id}`}
              className="relative block rounded-2xl overflow-hidden bg-white dark:bg-night-surface border-2 border-navy dark:border-white/15 shadow-toy-sm hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none transition-[transform,box-shadow] duration-150 ease-soft-out"
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
                <PetPortrait
                  species={d.species}
                  breed={d.breed_display}
                  seed={d.id}
                  background
                  className="block w-full aspect-square"
                />
              )}
              {!d.adopted_at && d.is_active && (
                <Badge variant="rescue" className="absolute top-2 left-2">
                  Needs a home
                </Badge>
              )}
              <div className="p-2.5 border-t-2 border-navy dark:border-white/15">
                <p className="text-base font-extrabold text-navy dark:text-biscuit truncate">{d.name}</p>
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
          pets={pets.filter((d) => !d.adopted_at && d.is_active)}
        />
      </div>
    </div>
  );
}
