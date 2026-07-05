import Button from './Button';
import DogIllustration from '../flair/DogIllustration';
import type { DogIllustrationName } from '../flair/DogIllustration';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  illustration?: DogIllustrationName;
}

export default function ErrorState({
  message = 'Something went wrong.',
  onRetry,
  illustration = 'digging',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6 animate-fade-in-up">
      <DogIllustration
        name={illustration}
        className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
      />
      <p className="text-gray-800 dark:text-gray-100 font-semibold text-base tracking-tight mb-1">{message}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 text-balance max-w-[18rem]">
        Check your connection and try again.
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
