import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDonationBySession, formatCents, type Donation } from '../api/donations';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Spinner } from '../components/ui/Skeleton';
import DogIllustration from '../components/flair/DogIllustration';
import { usePawBurst } from '../components/flair/PawBurst';
import { appToast } from '../utils/appToast';
import { useDocumentTitle } from '../utils/useDocumentTitle';

type Status = 'verifying' | 'success' | 'processing' | 'error';

const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 2500;

export default function DonateReturnPage() {
  useDocumentTitle('Thank you · Fetchpawz');
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = useState<Status>(sessionId ? 'verifying' : 'error');
  const [donation, setDonation] = useState<Donation | null>(null);
  const { fire, PawBurstLayer } = usePawBurst();
  const celebrated = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const check = async (attempt: number) => {
      try {
        const d = await getDonationBySession(sessionId);
        if (cancelled) return;
        if (d.status === 'succeeded') {
          setDonation(d);
          setStatus('success');
          if (!celebrated.current) {
            celebrated.current = true;
            fire({ count: 14 });
            appToast.celebrate('Thank you!');
          }
          return;
        }
        // Webhook may not have landed yet — poll a few times, then show
        // "processing" (the history page will reflect it once confirmed).
        if (d.status === 'pending' && attempt < POLL_ATTEMPTS) {
          setTimeout(() => check(attempt + 1), POLL_DELAY_MS);
          return;
        }
        setDonation(d);
        setStatus(d.status === 'pending' ? 'processing' : 'error');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    check(0);
    return () => {
      cancelled = true;
    };
  }, [sessionId, fire]);

  return (
    <div className="p-4 pt-10">
      <Card className="relative max-w-sm mx-auto flex flex-col items-center text-center" padding="lg">
        <PawBurstLayer />
        {status === 'verifying' && (
          <>
            <Spinner className="h-8 w-8 my-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Confirming your donation…
            </p>
          </>
        )}
        {status === 'success' && donation && (
          <>
            <DogIllustration
              name="ball"
              className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
            />
            <h1 className="text-2xl font-bold mb-1">You're a good human!</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Your {formatCents(donation.amount_cents)} donation to{' '}
              <span className="font-semibold">{donation.recipient_name}</span> went
              through. 🐾
            </p>
            <div className="flex gap-2">
              <Link to="/app/donations">
                <Button variant="secondary">My donations</Button>
              </Link>
              <Link to="/app/home">
                <Button>Back home</Button>
              </Link>
            </div>
          </>
        )}
        {status === 'processing' && (
          <>
            <DogIllustration
              name="sniffing"
              className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
            />
            <h1 className="text-xl font-bold mb-1">Payment is processing</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              We'll confirm it shortly — check your donation history in a minute.
            </p>
            <Link to="/app/donations">
              <Button variant="secondary">My donations</Button>
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <DogIllustration
              name="howling"
              className="mb-4 h-28 w-auto text-gray-400 dark:text-gray-500"
            />
            <h1 className="text-xl font-bold mb-1">We couldn't find that donation</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              If you completed payment, it'll show up in your history shortly.
            </p>
            <Link to="/app/donations">
              <Button variant="secondary">My donations</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
