import type { CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicDog } from '../api/publicSite';
import { isNotFound } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Badge from '../components/ui/Badge';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import PawTrail from '../components/flair/PawTrail';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import { Crown } from '../components/brand/RankMedal';
import FoundPetForm from './FoundPetForm';
import { photoIn } from '../utils/photoIn';
import Rosette from '../components/brand/Rosette';
import { formatWeekOf, weekBucket } from '../utils/weeklyReset';

function ageLabel(birthday: string | null): string | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  const months = Math.max(0, Math.floor((Date.now() - b.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
}

// A drawn icon inside a colour badge: the bean takes the ink, not its own colour.
const BEAN_INK = { '--bean': 'currentColor' } as CSSProperties;

export default function PublicPetPage() {
  const { petId } = useParams();
  // Present only when the visitor got here by scanning a collar tag; it is the
  // credential for the finder->owner relay.
  const [searchParams] = useSearchParams();
  const tagCode = searchParams.get('tag');
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
        <DogIllustration name="digging" className="mx-auto h-32 w-auto" />
        <h1 className="mt-5 font-plain text-2xl text-navy dark:text-biscuit text-balance">
          {isError && !isNotFound(error) ? "Couldn't load this page" : 'This pet page is private'}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {isError && !isNotFound(error)
            ? 'Something went wrong on our end. Try again in a moment.'
            : "Either this pet's page was turned off by their human, or the link is wrong."}
        </p>
        <Link to="/" className="btn btn-primary mt-6">
          Meet Fetchpawz
        </Link>
      </div>
    );
  }

  const age = ageLabel(pet.birthday);

  const latestCrown = pet.crown_weeks[0];

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 lg:py-14">
        {/* The trading card: white, the navy line and the toy shadow, the
            photo on a tint and the name in Bagel. */}
        <article className="toy overflow-hidden rounded-3xl bg-white dark:bg-night-surface">
          <div className="relative aspect-square sm:aspect-[4/3] bg-brand-100 dark:bg-night-raised border-b-[2.5px] border-navy dark:border-night-raised">
            {pet.primary_photo_url ? (
              <img
                ref={photoIn}
                src={pet.primary_photo_url}
                alt={`Photo of ${pet.name}`}
                className="photo-in absolute inset-0 h-full w-full object-cover"
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
              <Badge
                variant="rescue"
                size="md"
                className="absolute top-4 left-4"
                icon={<BrandIcon name="rescue" size={14} style={BEAN_INK} />}
              >
                Needs a home
              </Badge>
            )}
            {pet.adopted && (
              <Badge variant="success" size="md" className="absolute top-4 left-4">
                Adopted
              </Badge>
            )}
            {/* The payoff for a shared crown: the rosette pinned to the photo,
                for its latest win. The page's one tilted thing. */}
            {latestCrown && (
              <div className="absolute bottom-3 right-3 w-28 -rotate-6 drop-shadow-[0_6px_10px_rgba(17,19,46,0.35)] sm:w-36">
                <Rosette
                  title={pet.species === 'cat' ? 'Top Cat' : 'Top Dog'}
                  caption={latestCrown === weekBucket(0) ? 'This week' : formatWeekOf(latestCrown)}
                  className="block w-full"
                />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="p-5 sm:p-6">
            <h1 className="flex flex-wrap items-center gap-2 text-[40px] leading-none text-navy dark:text-biscuit [overflow-wrap:anywhere]">
              {pet.name}
              {/* Gold is earned: a crown per week this pet wore it. */}
              {pet.crown_weeks.map((week) => (
                <span
                  key={week}
                  role="img"
                  title={`Top Pet, week of ${formatWeekOf(week)}`}
                  aria-label={`Top Pet, week of ${formatWeekOf(week)}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-gold-500"
                >
                  <Crown className="w-5" />
                </span>
              ))}
            </h1>
            <p className="mt-2 text-[15px] font-semibold text-gray-600 dark:text-gray-300">
              {[pet.breed_display, age].filter(Boolean).join(' · ')}
            </p>
            {pet.rescue_name && (
              <p className="mt-1 text-sm font-bold text-pink-700 dark:text-pink-300">
                Listed by {pet.rescue_name}
              </p>
            )}

            {pet.traits.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pet.traits.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* Arrived by scanning the collar tag: lead with the thing a finder
            actually needs, right under the card, before the marketing. */}
        {tagCode && (
          <div className="mt-6">
            <FoundPetForm code={tagCode} petName={pet.name} />
          </div>
        )}

        {pet.bio && (
          <p className="mt-6 text-base leading-relaxed text-gray-700 dark:text-gray-200">{pet.bio}</p>
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
                className="aspect-square w-full rounded-lg border border-gray-200 bg-brand-100 object-cover dark:border-white/10 dark:bg-night-raised"
              />
            ))}
          </div>
        )}

        {/* Pitch — lead with whatever this pet's page is really about. A pet
            who needs a home gets Forever Pink; everyone else Ball Orange.
            Navy on colour either way. */}
        <div
          className={`relative mt-10 overflow-hidden rounded-3xl border-[2.5px] border-navy px-6 py-10 text-center text-navy dark:border-night-raised ${
            pet.adoptable ? 'bg-pink-500' : 'bg-brand-500'
          }`}
        >
          <PawTrail steps={5} size={18} className="absolute bottom-6 left-6 text-navy/15" />
          <p className="relative text-xl font-extrabold tracking-tight text-balance">
            {pet.adoptable
              ? `${pet.name} is looking for a home on Fetchpawz.`
              : pet.crown_weeks.length > 0
                ? `${pet.name} is a certified Top Pet on Fetchpawz.`
                : `${pet.name} lives on Fetchpawz — the app that gets pets home.`}
          </p>
          <p className="relative mt-1.5 text-sm font-medium text-navy">
            {pet.adoptable
              ? 'Adoptable rescue pets swipe right past you in the feed. Meet them, fall for one, take them home.'
              : pet.crown_weeks.length > 0
                ? "Swipe the neighborhood's cats and dogs and crown the next weekly champion."
                : 'Swipe good pets, crown a weekly champion, and help lost pets get home.'}
          </p>
          <Link to="/" className="btn btn-paper relative mt-5">
            Meet Fetchpawz
          </Link>
        </div>
      </div>
    </div>
  );
}
