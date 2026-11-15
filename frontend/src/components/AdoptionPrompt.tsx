import { Link } from 'react-router-dom';
import BrandIcon from './brand/BrandIcon';
import Badge from './ui/Badge';

interface Props {
  petId: string;
  dogName: string;
  rescueName: string | null;
  onDismiss: () => void;
}

export default function AdoptionPrompt({ petId, dogName, rescueName, onDismiss }: Props) {
  return (
    // Pink marks the rescue, never the pet's sadness. Same dignity as any
    // other card; the actions change to the two things you can do.
    <div className="mt-3 w-full animate-fade-in-up rounded-2xl border-2 border-navy bg-pink-100 p-4 text-navy dark:border-pink-400/50 dark:bg-pink-500/15 dark:text-biscuit">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-white text-navy" aria-hidden>
          <BrandIcon name="rescue" size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <Badge variant="rescue" className="mb-1.5">Needs a home</Badge>
          <p className="font-extrabold text-navy dark:text-biscuit">
            {dogName} is looking for a home
          </p>
          <p className="text-sm text-navy dark:text-biscuit/85 mt-0.5">
            {rescueName
              ? `${rescueName} has ${dogName} available for adoption.`
              : `${dogName} is available for adoption.`}
          </p>
          <div className="flex gap-2 mt-3">
            <Link
              to={`/app/pets/${petId}`}
              onClick={onDismiss}
              className="btn btn-rescue btn-sm"
            >
              Meet {dogName}
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="btn btn-ghost btn-sm"
            >
              Keep rating
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
