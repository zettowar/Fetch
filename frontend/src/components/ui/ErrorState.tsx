import Button from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <span className="text-3xl mb-2">{'\u26a0\ufe0f'}</span>
      <p className="text-gray-600 font-medium mb-1">{message}</p>
      <p className="text-sm text-gray-400 mb-4">Check your connection and try again.</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
