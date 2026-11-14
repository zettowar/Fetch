import Button from './Button';
import PetIllustration, { type IllustrationName } from '../flair/PetIllustration';
import type { Species } from '../../types';

interface ErrorStateProps {
  message?: string;
  /**
   * Secondary line under the message. Left unset it reads "Check your
   * connection and try again." — but only when there is something to retry.
   * A definitive answer ("Pet not found", "only for rescue accounts") has no
   * retry, and telling that person to check their connection is wrong, so
   * those render the message alone unless they pass a hint of their own.
   */
  hint?: string;
  onRetry?: () => void;
  illustration?: IllustrationName;
  species?: Species;
}

const RETRY_HINT = 'Check your connection and try again.';
/** For "X not found" states: the two honest reasons a link can dead-end. */
export const NOT_FOUND_HINT = 'It may have been removed, or the link is wrong.';

export default function ErrorState({
  message = 'Something went wrong.',
  hint,
  onRetry,
  illustration = 'digging',
  species = 'dog',
}: ErrorStateProps) {
  const secondary = hint ?? (onRetry ? RETRY_HINT : null);
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6 animate-fade-in-up">
      <PetIllustration
        name={illustration}
        species={species}
        className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
      />
      <p className="text-gray-800 dark:text-gray-100 font-semibold text-base tracking-tight mb-1">{message}</p>
      {secondary && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-balance max-w-[18rem]">
          {secondary}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}
