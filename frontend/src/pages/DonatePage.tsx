import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Heart } from 'lucide-react';
import {
  createDonationCheckout,
  formatCents,
  getDonationConfig,
} from '../api/donations';
import { listRescues, type RescuePublic } from '../api/rescues';
import BrandIcon from '../components/brand/BrandIcon';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import TailUnderline from '../components/brand/TailUnderline';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import PawTrail from '../components/flair/PawTrail';
import { appToast } from '../utils/appToast';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// A tile you can touch: 2px Leash Navy line on the toy shadow. Picked, it
// takes its recipient's colour: Ball Orange for Fetchpawz, Forever Pink for
// a rescue.
const TILE =
  'rounded-2xl border-2 border-navy text-left shadow-toy-sm transition-[transform,box-shadow,background-color] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/15';
const TILE_IDLE = 'bg-white dark:bg-night-surface';
const TILE_PLATFORM_ON = 'bg-brand-100 dark:bg-brand-500/20';
const TILE_RESCUE_ON = 'bg-pink-100 dark:bg-pink-500/20';
const SECTION_TITLE = 'text-base font-extrabold tracking-tight text-navy dark:text-biscuit mb-2';

function RescueMark() {
  return (
    <span
      className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-pink-100 text-navy dark:border-white/15 dark:bg-pink-500/20 dark:text-biscuit"
      aria-hidden
    >
      <BrandIcon name="rescue" size={20} />
    </span>
  );
}

type Recipient =
  | { type: 'platform' }
  | { type: 'rescue'; rescue: RescuePublic };

export default function DonatePage() {
  useDocumentTitle('Donate · Fetchpawz');
  const [params, setParams] = useSearchParams();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['donation-config'],
    queryFn: getDonationConfig,
  });
  const [search, setSearch] = useState('');
  const {
    data: rescues = [],
    isLoading: rescuesLoading,
    isError: rescuesFailed,
    refetch: refetchRescues,
  } = useQuery({
    queryKey: ['rescues', search],
    queryFn: () => listRescues(search || undefined),
  });

  const [recipient, setRecipient] = useState<Recipient>({ type: 'platform' });
  const [amountCents, setAmountCents] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>();

  // ?cancelled=1 — bounced back from Stripe without paying.
  useEffect(() => {
    if (params.get('cancelled')) {
      appToast.error('Donation cancelled — no charge was made.');
      params.delete('cancelled');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // ?rescue={id} — deep link from a rescue profile preselects it.
  // Applied once. Re-running whenever the recipient was the platform meant a
  // visitor who arrived from a rescue page could never choose "Support
  // Fetchpawz": picking it snapped the selection straight back to the rescue.
  const preselectId = params.get('rescue');
  const preselectApplied = useRef(false);
  useEffect(() => {
    if (!preselectId || preselectApplied.current) return;
    const match = rescues.find((r) => r.id === preselectId);
    if (!match) return; // rescues not loaded yet — try again when they are
    preselectApplied.current = true;
    if (match.donations_enabled) setRecipient({ type: 'rescue', rescue: match });
  }, [preselectId, rescues]);

  const effectiveCents = useMemo(() => {
    if (customAmount.trim()) {
      const dollars = Number(customAmount);
      if (!Number.isFinite(dollars)) return null;
      return Math.round(dollars * 100);
    }
    return amountCents;
  }, [customAmount, amountCents]);

  const donate = async () => {
    if (!config || effectiveCents == null) return;
    if (effectiveCents < config.min_cents || effectiveCents > config.max_cents) {
      setAmountError(
        `Choose between ${formatCents(config.min_cents)} and ${formatCents(config.max_cents)}.`,
      );
      return;
    }
    setAmountError(undefined);
    setSubmitting(true);
    try {
      const res = await createDonationCheckout({
        amount_cents: effectiveCents,
        recipient_type: recipient.type,
        rescue_id: recipient.type === 'rescue' ? recipient.rescue.id : undefined,
        message: message.trim() || undefined,
      });
      window.location.href = res.checkout_url;
    } catch (err) {
      appToast.error(apiErrorMessage(err, 'Could not start the donation.'));
      setSubmitting(false);
    }
  };

  const recipientLabel =
    recipient.type === 'platform' ? 'Fetchpawz' : recipient.rescue.org_name;

  // Only rescues that can actually take money — in-app or via external link.
  const donatable = rescues.filter((r) => r.donations_enabled || r.donation_url);

  return (
    <div className="p-4 flex flex-col gap-5">
      <PageHeader
        title="Donate"
        subtitle={
          <span className="mt-1 block font-display text-2xl leading-tight text-navy dark:text-biscuit">
            Every <TailUnderline>bone counts.</TailUnderline>
          </span>
        }
        back
        backFallback="/app/home"
      />

      {configLoading ? (
        <ListSkeleton rows={4} />
      ) : !config?.enabled ? (
        <>
          <EmptyState
            illustration="sleeping"
            title="In-app donations are coming soon"
            body="Meanwhile, many rescues take donations directly through their own pages."
          />
          <RescueLinkList rescues={rescues} loading={rescuesLoading} />
        </>
      ) : (
        <>
          {/* Recipient */}
          <section>
            <h2 className={SECTION_TITLE}>
              Who are you supporting?
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setRecipient({ type: 'platform' })}
                className={`relative overflow-hidden p-3.5 ${TILE} ${
                  recipient.type === 'platform' ? TILE_PLATFORM_ON : TILE_IDLE
                }`}
              >
                <PawTrail
                  steps={3}
                  direction={-18}
                  size={12}
                  className="absolute top-2 right-3 text-navy/15 dark:text-biscuit/15"
                />
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-brand-500 text-navy" aria-hidden>
                    <BrandIcon name="donate" size={20} style={{ '--bean': 'var(--paper)' } as CSSProperties} />
                  </span>
                  <div>
                    <p className="text-base font-extrabold text-navy dark:text-biscuit">Support Fetchpawz</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Keep the pack running — servers, treats, and new features.
                    </p>
                  </div>
                </div>
              </button>

              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search rescues…"
                aria-label="Search rescues"
              />
              {rescuesLoading ? (
                <ListSkeleton rows={3} />
              ) : rescuesFailed ? (
                <ErrorState message="Couldn't load rescues." onRetry={() => refetchRescues()} />
              ) : donatable.length === 0 ? (
                <EmptyState
                  illustration="sniffing"
                  title={search ? 'No rescues found' : 'No rescues taking donations yet'}
                  body={search ? 'Try a different search.' : 'Check back soon — or support Fetchpawz above.'}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {donatable.map((rescue) => {
                    const selected =
                      recipient.type === 'rescue' && recipient.rescue.id === rescue.id;
                    if (rescue.donations_enabled) {
                      return (
                        <li key={rescue.id}>
                          <button
                            type="button"
                            onClick={() => setRecipient({ type: 'rescue', rescue })}
                            className={`w-full p-3 ${TILE} ${selected ? TILE_RESCUE_ON : TILE_IDLE}`}
                          >
                            <div className="flex items-center gap-3">
                              <RescueMark />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-extrabold text-navy dark:text-biscuit truncate">
                                  {rescue.org_name}
                                </p>
                                {rescue.location && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{rescue.location}</p>
                                )}
                              </div>
                              <Badge variant="brand" icon={<Heart size={11} aria-hidden />}>
                                In-app
                              </Badge>
                            </div>
                          </button>
                        </li>
                      );
                    }
                    if (!rescue.donation_url) return null;
                    return (
                      <li key={rescue.id}>
                        <a
                          href={rescue.donation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-3 p-3 ${TILE} ${TILE_IDLE}`}
                        >
                          <RescueMark />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-navy dark:text-biscuit truncate">
                              {rescue.org_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Donates via their own page
                            </p>
                          </div>
                          <ExternalLink size={16} aria-hidden className="text-gray-500 dark:text-gray-400 shrink-0" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Amount */}
          <Card as="section" padding="md">
            <h2 className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit mb-3">
              Donation to {recipientLabel}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 mb-4" role="radiogroup" aria-label="Amount">
              {config.presets_cents.map((cents) => {
                const active = !customAmount && amountCents === cents;
                return (
                  <button
                    key={cents}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setAmountCents(cents);
                      setCustomAmount('');
                      setAmountError(undefined);
                    }}
                    // Chunky Bagel tiles: white on a navy line, the picked one
                    // in Ball Orange.
                    className={`min-h-[60px] rounded-lg border-2 border-navy px-3 py-2.5 text-center font-display text-2xl leading-none tabular-nums shadow-toy-sm transition-[transform,box-shadow,background-color] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none ${
                      active
                        ? 'bg-brand-500 text-navy dark:border-navy'
                        : 'bg-white text-navy dark:border-white/15 dark:bg-night-surface dark:text-biscuit'
                    }`}
                  >
                    {formatCents(cents)}
                  </button>
                );
              })}
            </div>
            <Input
              label="Custom amount (USD)"
              type="number"
              inputMode="decimal"
              min={config.min_cents / 100}
              max={config.max_cents / 100}
              step="1"
              placeholder="e.g. 15"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setAmountError(undefined);
              }}
              error={amountError}
            />
            <div className="mt-3">
              <Input
                label="Message (optional)"
                maxLength={280}
                placeholder={
                  recipient.type === 'rescue'
                    ? `A note for ${recipientLabel}`
                    : 'Anything you want to tell us?'
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {recipient.type === 'rescue' && config.platform_fee_percent > 0 && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {config.platform_fee_percent}% supports Fetchpawz's platform costs; the
                rest goes straight to {recipientLabel}.
              </p>
            )}
            <Button
              className="w-full mt-4"
              size="lg"
              // Platform gifts are Ball Orange; a gift to a rescue is Forever Pink.
              variant={recipient.type === 'rescue' ? 'rescue' : 'primary'}
              loading={submitting}
              disabled={effectiveCents == null}
              onClick={donate}
            >
              Donate{effectiveCents ? ` ${formatCents(effectiveCents)}` : ''}
            </Button>
            <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
              Secure checkout by Stripe. You'll be redirected to complete payment.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function RescueLinkList({
  rescues,
  loading,
}: {
  rescues: RescuePublic[];
  loading: boolean;
}) {
  const donating = rescues.filter((r) => r.donation_url);
  if (loading || donating.length === 0) return null;
  return (
    <section>
      <h2 className={SECTION_TITLE}>
        Donate to a rescue
      </h2>
      <ul className="flex flex-col gap-2">
        {donating.map((rescue) => (
          <li key={rescue.id}>
            <a
              href={rescue.donation_url!}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 ${TILE} ${TILE_IDLE}`}
            >
              <RescueMark />
              <span className="min-w-0 flex-1 text-sm font-extrabold text-navy dark:text-biscuit truncate">
                {rescue.org_name}
              </span>
              <ExternalLink size={16} aria-hidden className="text-gray-500 dark:text-gray-400 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
