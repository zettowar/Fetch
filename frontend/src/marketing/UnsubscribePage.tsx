import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { unsubscribe, type UnsubscribeResult } from '../api/publicSite';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { Spinner } from '../components/ui/Skeleton';
import BrandIcon from '../components/brand/BrandIcon';

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
        <Spinner size="lg" className="justify-center" />
      ) : (
        <>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-navy dark:bg-brand-500/20 dark:text-biscuit">
            <BrandIcon name="mail" size={32} />
          </span>
          {/* Done is good news (Bagel); a dead link or an outage is the calm,
              plain register. */}
          <h1
            className={`mt-5 text-navy dark:text-biscuit text-balance ${
              done ? 'text-[32px] leading-tight' : 'font-plain text-2xl'
            }`}
          >
            {done
              ? "You're unsubscribed"
              : invalid
                ? 'That link has expired'
                : "Something went wrong"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {done ? (
              <>
                You won&rsquo;t get{' '}
                <strong className="font-extrabold text-navy dark:text-biscuit">{result.label?.toLowerCase()}</strong>{' '}
                from us any more. Account and security emails &mdash; password
                resets, email verification &mdash; still come through.
              </>
            ) : invalid ? (
              "We couldn't read that unsubscribe link. You can change every email setting from your notification settings instead."
            ) : (
              'We could not reach the server. Please try the link again in a moment.'
            )}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/app/notifications?tab=settings" className="btn btn-primary">
              Notification settings
            </Link>
            <Link to="/" className="btn btn-secondary">
              Back to Fetchpawz
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
