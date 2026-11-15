import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, MapPin } from 'lucide-react';
import { getPublicRescue } from '../api/publicSite';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Badge from '../components/ui/Badge';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import PawTrail from '../components/flair/PawTrail';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';

// A drawn icon on a pink fill: the bean takes the ink (or white), not pink.
const BEAN_INK = { '--bean': 'currentColor' } as CSSProperties;
const BEAN_WHITE = { '--bean': '#fff' } as CSSProperties;

export default function PublicRescuePage() {
  const { slug } = useParams();
  const { data: rescue, isLoading, isError, error } = useQuery({
    queryKey: ['public-rescue', slug],
    queryFn: () => getPublicRescue(slug!),
    enabled: !!slug,
    retry: (count, err) => !isNotFound(err) && count < 2,
  });
  useDocumentTitle(rescue ? `${rescue.org_name} · Fetchpawz` : 'Fetchpawz');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  if (isError || !rescue) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <DogIllustration name="digging" className="mx-auto h-32 w-auto" />
        <h1 className="mt-5 font-plain text-2xl text-navy dark:text-biscuit text-balance">
          {isError && !isNotFound(error) ? "Couldn't load this page" : 'Rescue not found'}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {isError && !isNotFound(error)
            ? 'Something went wrong on our end. Try again in a moment.'
            : 'This rescue page is unavailable or the link is wrong.'}
        </p>
        <Link to="/" className="btn btn-primary mt-6">
          Meet Fetchpawz
        </Link>
      </div>
    );
  }

  // External link if the rescue provided one; otherwise the in-app donate flow
  // (which prompts login for a logged-out visitor).
  const showDonate = !!rescue.donation_url || rescue.donations_enabled;

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 lg:py-12">
        {/* Cover — a rescue page leads with Forever Pink. */}
        <div className="relative overflow-hidden rounded-3xl border-[2.5px] border-navy bg-pink-100 dark:border-night-raised dark:bg-pink-500/15 aspect-[3/1] sm:aspect-[4/1]">
          {rescue.cover_url ? (
            <img src={rescue.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <PawTrail steps={6} size={20} className="absolute bottom-5 right-8 text-pink-400 dark:text-pink-500/40" />
          )}
        </div>

        {/* Logo + identity, overlapping the cover */}
        <div className="-mt-12 px-2 sm:px-4 flex items-end gap-4">
          <div
            style={BEAN_WHITE}
            className="toy relative flex-shrink-0 w-24 h-24 rounded-2xl bg-pink-500 text-navy overflow-hidden flex items-center justify-center"
          >
            {rescue.logo_url ? (
              <img src={rescue.logo_url} alt={`${rescue.org_name} logo`} className="h-full w-full bg-white object-cover" />
            ) : (
              <BrandIcon name="rescue" size={44} />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-[30px] sm:text-[40px] leading-none text-navy dark:text-biscuit text-balance">
              {rescue.org_name}
            </h1>
            {rescue.location && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                <MapPin size={14} aria-hidden /> {rescue.location}
              </p>
            )}
          </div>
        </div>

        {/* Actions — Donate is the rescue's own button, in pink. */}
        {(showDonate || rescue.website) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {showDonate &&
              (rescue.donation_url ? (
                <a
                  href={rescue.donation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-rescue"
                >
                  <BrandIcon name="donate" size={20} style={BEAN_INK} /> Donate
                </a>
              ) : (
                <Link to={`/app/rescues/${rescue.id}`} className="btn btn-rescue">
                  <BrandIcon name="donate" size={20} style={BEAN_INK} /> Donate
                </Link>
              ))}
            {rescue.website && (
              <a
                href={rescue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <Globe size={16} aria-hidden /> Website
              </a>
            )}
          </div>
        )}

        {/* About */}
        {rescue.description && (
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-gray-700 dark:text-gray-200">
            {rescue.description}
          </p>
        )}

        {/* Adoptable pets */}
        <section className="mt-10">
          <h2 className="text-lg font-extrabold text-navy dark:text-biscuit">
            Adoptable pets{' '}
            {rescue.pets.length > 0 && (
              <span className="text-gray-500 dark:text-gray-400">({rescue.pets.length})</span>
            )}
          </h2>
          {rescue.pets.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              No pets are up for adoption right now. Check back soon!
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {rescue.pets.map((pet) => (
                // Trading cards: things you can touch, so the navy line and
                // the toy shadow, pressing down onto it.
                <Link
                  key={pet.id}
                  to={`/pets/${pet.id}`}
                  className="group block overflow-hidden rounded-2xl border-[2.5px] border-navy bg-white shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-night-raised dark:bg-night-surface"
                >
                  <div className="relative aspect-square border-b-2 border-navy bg-pink-100 dark:border-night-raised dark:bg-night-raised">
                    {pet.primary_photo_url ? (
                      <img
                        src={pet.primary_photo_url}
                        alt={pet.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <PetPortrait
                        species={pet.species}
                        breed={pet.breed_display}
                        seed={pet.id}
                        background
                        className="absolute inset-0 h-full w-full"
                      />
                    )}
                    {pet.adoptable && (
                      <Badge variant="rescue" className="absolute top-2 left-2">
                        Needs a home
                      </Badge>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display text-2xl leading-tight text-navy dark:text-biscuit truncate">{pet.name}</p>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{pet.breed_display}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Fetchpawz pitch — Forever Pink, navy on colour. */}
        <div className="relative mt-12 overflow-hidden rounded-3xl border-[2.5px] border-navy bg-pink-500 px-6 py-10 text-center text-navy dark:border-night-raised">
          <PawTrail steps={5} size={18} className="absolute bottom-6 left-6 text-navy/15" />
          <p className="relative text-xl font-extrabold tracking-tight text-balance">
            {rescue.org_name} finds homes for pets on Fetchpawz.
          </p>
          <p className="relative mt-1.5 text-sm font-medium text-navy">
            Meet their adoptable pets in the swipe feed, follow your favorites,
            and support the rescue in a couple of taps.
          </p>
          <Link to="/" className="btn btn-paper relative mt-5">
            Meet Fetchpawz
          </Link>
        </div>
      </div>
    </div>
  );
}
