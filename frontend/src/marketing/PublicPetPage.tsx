import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HousePlus } from 'lucide-react';
import { getPublicDog } from '../api/publicSite';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Badge from '../components/ui/Badge';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import PawTrail from '../components/flair/PawTrail';

function ageLabel(birthday: string | null): string | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const months = Math.max(0, Math.floor((Date.now() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

export default function PublicPetPage() {
  const { petId } = useParams();
  const { data: pet, isLoading, isError, error } = useQuery({
    queryKey: ['public-pet', petId],
    queryFn: () => getPublicDog(petId!),
    enabled: !!petId,
    retry: (count, err) => !isNotFound(err) && count < 2,
  });
  useDocumentTitle(pet ? `${pet.name} · Fetchpawz` : 'Fetchpawz');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  if (isError || !pet) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <DogIllustration
          name="digging"
          className="mx-auto h-32 w-auto text-gray-400 dark:text-gray-500"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {isError && !isNotFound(error) ? "Couldn't load this page" : 'This pup is private'}
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          {isError && !isNotFound(error)
            ? 'Something went wrong on our end. Try again in a moment.'
            : "Either this pet's page was turned off by their human, or the link is wrong."}
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

  const age = ageLabel(pet.birthday);

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 lg:py-14">
        {/* Hero photo */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 aspect-square sm:aspect-[4/3]">
          {pet.primary_photo_url ? (
            <img
              src={pet.primary_photo_url}
              alt={`Photo of ${pet.name}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-8xl" aria-hidden>{pet.species === 'cat' ? '🐈' : '🐕'}</span>
          )}
          {pet.adoptable && (
            <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-soft-lg">
              <HousePlus size={12} aria-hidden /> Looking for a home
            </span>
          )}
          {pet.adopted && (
            <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-success-500 px-3 py-1 text-xs font-semibold text-white shadow-soft-lg">
              <span aria-hidden>🎉</span> Adopted
            </span>
          )}
        </div>

        {/* Identity */}
        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
              {pet.name}
              {pet.crown_weeks.map((week) => (
                <span
                  key={week}
                  title={`Top Pet, week of ${week}`}
                  className="text-2xl"
                  aria-label={`Top Pet, week of ${week}`}
                >
                  🏆
                </span>
              ))}
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {[pet.breed_display, age].filter(Boolean).join(' · ')}
            </p>
            {pet.rescue_name && (
              <p className="mt-1 text-sm text-purple-600 dark:text-purple-400 font-medium">
                Listed by {pet.rescue_name}
              </p>
            )}
          </div>
        </div>

        {pet.traits.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {pet.traits.map((t) => (
              <Badge key={t} variant="brand" size="md">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {pet.bio && (
          <p className="mt-5 text-base leading-relaxed text-gray-600 dark:text-gray-300">{pet.bio}</p>
        )}

        {/* Extra photos */}
        {pet.photo_urls.length > 1 && (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {pet.photo_urls.slice(0, 6).map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`Photo ${i + 1} of ${pet.name}`}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {/* Pitch */}
        <div className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-10 text-center text-white shadow-soft-lg">
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <PawTrail steps={5} size={18} className="absolute bottom-6 left-6 text-white/15" />
          <p className="relative text-xl font-bold tracking-tight text-balance">
            {pet.name} lives on Fetchpawz, the pet app that gets rescues adopted.
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
