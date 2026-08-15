import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MailX } from 'lucide-react';
import { unsubscribe, type UnsubscribeResult } from '../api/publicSite';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';

/**
 * Where the footer "Unsubscribe" link lands.
 *
 * Deliberately no confirm step: someone who clicked unsubscribe has already
 * told us what they want, and making them click twice is the pattern the
 * anti-spam rules exist to stamp out. Unauthenticated — the signed token in the
 * URL is the credential, and it can only ever turn a preference off.
 */
export default function UnsubscribePage() {
  const { token } = useParams();
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useDocumentTitle('Unsubscribe · Fetchpawz');

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;
    unsubscribe(token)
      .then(setResult)
      .catch(() => setFailed(true));
  }, [token]);

  const done = result?.status === 'ok';
  const invalid = result?.status === 'invalid';

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      {!result && !failed ? (
        <Spinner className="mx-auto h-8 w-8" />
      ) : (
        <>
          <MailX
            size={40}
            className="mx-auto text-gray-400 dark:text-gray-500"
            aria-hidden
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {done
              ? "You're unsubscribed"
              : invalid
                ? 'That link has expired'
                : "Something went wrong"}
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {done ? (
              <>
                You won&rsquo;t get <strong>{result.label?.toLowerCase()}</strong>{' '}
                from us any more. Account and security emails &mdash; password
                resets, email verification &mdash; still come through.
              </>
            ) : invalid ? (
              "We couldn't read that unsubscribe link. You can change every email setting from your notification settings instead."
            ) : (
              'We could not reach the server. Please try the link again in a moment.'
            )}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              to="/app/notifications"
              className="inline-flex items-center rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Notification settings
            </Link>
            <Link
              to="/"
              className="inline-flex items-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Back to Fetchpawz
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
