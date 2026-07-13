import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, Heart, HousePlus, MapPin } from 'lucide-react';
import { getPublicRescue } from '../api/publicSite';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import PawTrail from '../components/flair/PawTrail';

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
        <DogIllustration name="digging" className="mx-auto h-32 w-auto text-gray-400 dark:text-gray-500" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {isError && !isNotFound(error) ? "Couldn't load this page" : 'Rescue not found'}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          {isError && !isNotFound(error)
            ? 'Something went wrong on our end. Try again in a moment.'
            : 'This rescue page is unavailable or the link is wrong.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
        >
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
        {/* Cover */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-100 to-brand-100 dark:from-purple-500/15 dark:to-brand-500/15 aspect-[3/1] sm:aspect-[4/1]">
          {rescue.cover_url && (
            <img src={rescue.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>

        {/* Logo + identity, overlapping the cover */}
        <div className="-mt-12 px-2 sm:px-4 flex items-end gap-4">
          <div className="flex-shrink-0 w-24 h-24 rounded-2xl bg-white dark:bg-gray-900 ring-4 ring-white dark:ring-gray-900 shadow-soft-lg overflow-hidden flex items-center justify-center">
            {rescue.logo_url ? (
              <img src={rescue.logo_url} alt={`${rescue.org_name} logo`} className="h-full w-full object-cover" />
            ) : (
              <HousePlus size={36} aria-hidden className="text-purple-500" />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{rescue.org_name}</h1>
            {rescue.location && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <MapPin size={14} aria-hidden /> {rescue.location}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {(showDonate || rescue.website) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {showDonate &&
              (rescue.donation_url ? (
                <a
                  href={rescue.donation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  <Heart size={16} aria-hidden /> Donate
                </a>
              ) : (
                <Link
                  to={`/app/rescues/${rescue.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  <Heart size={16} aria-hidden /> Donate
                </Link>
              ))}
            {rescue.website && (
              <a
                href={rescue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Globe size={16} aria-hidden /> Website
              </a>
            )}
          </div>
        )}

        {/* About */}
        {rescue.description && (
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-gray-600 dark:text-gray-300">
            {rescue.description}
          </p>
        )}

        {/* Adoptable pets */}
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">
            Adoptable pets {rescue.pets.length > 0 && <span className="text-gray-400">({rescue.pets.length})</span>}
          </h2>
          {rescue.pets.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No pets are up for adoption right now. Check back soon!
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rescue.pets.map((pet) => (
                <Link
                  key={pet.id}
                  to={`/pets/${pet.id}`}
                  className="group overflow-hidden rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-800 shadow-soft-sm hover:shadow-soft transition-shadow"
                >
                  <div className="relative aspect-square bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20">
                    {pet.primary_photo_url ? (
                      <img
                        src={pet.primary_photo_url}
                        alt={pet.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-5xl" aria-hidden>
                        {pet.species === 'cat' ? '🐈' : '🐕'}
                      </span>
                    )}
                    {pet.adoptable && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-soft">
                        <HousePlus size={10} aria-hidden /> Adopt
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-semibold text-sm truncate">{pet.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pet.breed_display}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Fetchpawz pitch */}
        <div className="relative mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-10 text-center text-white shadow-soft-lg">
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <PawTrail steps={5} size={18} className="absolute bottom-6 left-6 text-white/15" />
          <p className="relative text-xl font-bold tracking-tight text-balance">
            {rescue.org_name} is on Fetchpawz, the pet app that gets rescues adopted.
          </p>
          <p className="relative mt-1.5 text-sm text-white/85">
            Swipe good pets, crown a weekly champion, and help lost pets get home.
          </p>
          <Link
            to="/"
            className="relative mt-5 inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-soft-lg transition-transform duration-200 ease-soft-out hover:scale-[1.02] active:scale-95"
          >
            Meet Fetchpawz
          </Link>
        </div>
      </div>
    </div>
  );
}
