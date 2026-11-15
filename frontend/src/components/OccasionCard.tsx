import type { Pet } from '../types';
import type { Occasion } from '../utils/occasions';
import Accent from './brand/Accent';
import BrandIcon from './brand/BrandIcon';
import PetPortrait from './brand/PetPortrait';
import { petHeroPhoto } from '../utils/time';
import { photoIn } from '../utils/photoIn';
import { shareLink } from '../utils/shareLink';

/**
 * A pet's day on Home (beyond the brand book, in its spirit): a birthday on
 * Ball Orange's light plate, a homecoming — the anniversary of the day a
 * rescue handed them over — on Forever Pink's, because pink is for rescue and
 * adoption. A squiggle for excitement, a heart for a homecoming; one each.
 */
export default function OccasionCard({ pet, occasion }: { pet: Pet; occasion: Occasion }) {
  const birthday = occasion.kind === 'birthday';
  const photo = petHeroPhoto(pet);
  const years = `${occasion.years} ${occasion.years === 1 ? 'year' : 'years'}`;
  const since = pet.adopted_at
    ? new Date(pet.adopted_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  const title = birthday ? `Happy birthday, ${pet.name}!` : `${years} home, ${pet.name}`;
  const body = birthday
    ? `${occasion.years} today. Extra treats are not optional.`
    : `Home since ${since}${pet.rescue_name ? `, from ${pet.rescue_name}` : ''}. Best decision anyone made that day.`;
  const shareText = birthday
    ? `${pet.name} turns ${occasion.years} today`
    : `${pet.name} has been home for ${years} today`;

  return (
    <section
      className={`relative flex items-center gap-3.5 overflow-hidden rounded-3xl border-[2.5px] border-navy p-4 pr-5 text-navy shadow-toy animate-fade-in-up dark:border-white/15 dark:text-biscuit ${
        birthday ? 'bg-brand-100 dark:bg-brand-500/15' : 'bg-pink-100 dark:bg-pink-500/15'
      }`}
    >
      <Accent
        name={birthday ? 'squiggle' : 'heart'}
        className="absolute right-3 top-3 h-6 w-6 text-navy/70 dark:text-biscuit/70"
      />
      <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-navy bg-white dark:border-white/25 dark:bg-night-raised">
        {photo ? (
          <img ref={photoIn} src={photo} alt="" className="photo-in h-full w-full object-cover" />
        ) : (
          <PetPortrait species={pet.species} breed={pet.breed_display} seed={pet.id} crop="face" background className="h-full w-full" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="pr-6 font-display text-[24px] leading-[1.02]">{title}</p>
        <p className="mt-1 text-sm text-navy/80 dark:text-biscuit/80">{body}</p>
        {pet.is_public && (
          <button
            type="button"
            onClick={() => shareLink(`${window.location.origin}/pets/${pet.id}`, shareText)}
            className="btn btn-secondary btn-sm mt-2.5"
          >
            <BrandIcon name="share" size={16} />
            Share the day
          </button>
        )}
      </div>
    </section>
  );
}
