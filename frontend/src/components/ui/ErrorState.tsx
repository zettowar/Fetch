import Button from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6 animate-fade-in-up">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-500/20 dark:to-amber-600/20 shadow-soft-sm">
        <span className="text-2xl">{'\u26a0\ufe0f'}</span>
      </div>
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
