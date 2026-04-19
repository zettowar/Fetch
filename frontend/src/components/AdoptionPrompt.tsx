import { Link } from 'react-router-dom';

interface Props {
  dogId: string;
  dogName: string;
  rescueName: string | null;
  onDismiss: () => void;
}

export default function AdoptionPrompt({ dogId, dogName, rescueName, onDismiss }: Props) {
  return (
    <div className="mt-3 w-full animate-fade-in-up rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>🐾</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {dogName} is looking for a home
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            {rescueName
              ? `${rescueName} has ${dogName} available for adoption.`
              : `${dogName} is available for adoption.`}
          </p>
          <div className="flex gap-2 mt-3">
            <Link
              to={`/dogs/${dogId}`}
              onClick={onDismiss}
              className="text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Learn more
            </Link>
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
