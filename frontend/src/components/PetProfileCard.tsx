import { Link } from 'react-router-dom';
import type { Pet } from '../types';
import { petHeroPhoto } from '../utils/time';
import BrandIcon from './brand/BrandIcon';
import PetPortrait from './brand/PetPortrait';
import RankMedal from './brand/RankMedal';

interface PetProfileCardProps {
  pet: Pet;
  showEdit?: boolean;
  rank?: number;
}

export default function PetProfileCard({ pet, showEdit, rank }: PetProfileCardProps) {
  const photoUrl = petHeroPhoto(pet);
  const photoCount = pet.photos.length;
  const hasPhotos = photoCount > 0;

  return (
    // Stretched-link card (same pattern as RescueCard): the link to the pet is
    // an overlay SIBLING of the Edit link, not its parent. The whole card used
    // to be one <a> with the Edit <a> inside it — invalid HTML that browsers
    // and screen readers each untangle differently.
    // A pet card is a thing you touch: navy line, toy shadow, presses down.
    <div className="relative bg-white dark:bg-night-surface rounded-2xl border-2 border-navy dark:border-white/15 shadow-toy-sm overflow-hidden transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none">
      <Link
        to={`/app/pets/${pet.id}`}
        aria-label={`View ${pet.name}`}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-500"
      />
      <div className="relative aspect-[4/3] border-b-2 border-navy bg-gray-100 dark:border-white/15 dark:bg-night-raised">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={pet.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center overflow-hidden">
            <PetPortrait species={pet.species} breed={pet.breed_display} seed={pet.id} background className="absolute inset-0 h-full w-full" />
            <span className="relative mb-2 rounded-full border-[1.5px] border-navy bg-white px-2 py-0.5 text-2xs font-extrabold text-navy">
              {showEdit ? 'Tap to add a photo' : 'No photo yet'}
            </span>
          </div>
        )}
        {rank ? (
          <span className="absolute top-2 left-2" title={`Current rank: ${rank}`}>
            <RankMedal rank={rank} size="sm" />
          </span>
        ) : null}
        {photoCount > 1 && (
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy bg-white px-2 py-0.5 text-xs font-extrabold text-navy"
            title={`${photoCount} photos`}
            aria-label={`${photoCount} photos`}
          >
            <BrandIcon name="camera" size={13} />
            {photoCount}
          </span>
        )}
        {pet.rescue_id && (
          <span
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy bg-pink-500 px-2 py-0.5 text-2xs font-extrabold text-navy"
            title={pet.rescue_name ?? 'Rescue pet'}
          >
            Needs a home
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl leading-none text-navy dark:text-biscuit">{pet.name}</h3>
            {pet.breed_display && <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">{pet.breed_display}</p>}
          </div>
          <div className="flex items-center gap-2">
            {showEdit && !hasPhotos && (
              <span className="text-2xs bg-brand-100 dark:bg-brand-500/15 text-navy dark:text-brand-200 px-2 py-0.5 rounded-full font-extrabold">
                Add photo
              </span>
            )}
            {showEdit && (
              <Link
                to={`/app/pets/${pet.id}/edit`}
                className="btn btn-secondary btn-sm relative z-[2] min-h-[32px] px-3 text-xs"
              >
                Edit
              </Link>
            )}
          </div>
        </div>
        {pet.bio && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-2">{pet.bio}</p>}
      </div>
    </div>
  );
}
