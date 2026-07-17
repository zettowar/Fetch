import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Heart, HeartHandshake, HousePlus, PawPrint } from 'lucide-react';
import {
  createDonationCheckout,
  formatCents,
  getDonationConfig,
} from '../api/donations';
import { listRescues, type RescuePublic } from '../api/rescues';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { ListSkeleton } from '../components/ui/Skeleton';
import PawTrail from '../components/flair/PawTrail';
import { appToast } from '../utils/appToast';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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
  const { data: rescues = [], isLoading: rescuesLoading } = useQuery({
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
  const preselectId = params.get('rescue');
  useEffect(() => {
    if (!preselectId || recipient.type === 'rescue') return;
    const match = rescues.find((r) => r.id === preselectId);
    if (match?.donations_enabled) setRecipient({ type: 'rescue', rescue: match });
  }, [preselectId, rescues, recipient.type]);

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
        subtitle="Every bone counts."
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
            <h2 className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-200 mb-2">
              Who are you supporting?
            </h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setRecipient({ type: 'platform' })}
                className={`relative overflow-hidden text-left rounded-2xl border p-3.5 transition-all duration-200 ease-soft-out active:scale-[0.99] ${
                  recipient.type === 'platform'
                    ? 'border-brand-400 ring-2 ring-brand-200 dark:ring-brand-500/30 bg-brand-50/60 dark:bg-brand-500/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-200'
                }`}
              >
                <PawTrail
                  steps={3}
                  direction={-18}
                  size={12}
                  className="absolute top-2 right-3 text-brand-300/40 dark:text-brand-500/20"
                />
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white" aria-hidden>
                    <HeartHandshake size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Support Fetchpawz</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
                            className={`w-full text-left rounded-2xl border p-3 transition-all duration-200 ease-soft-out active:scale-[0.99] ${
                              selected
                                ? 'border-brand-400 ring-2 ring-brand-200 dark:ring-brand-500/30 bg-brand-50/60 dark:bg-brand-500/10'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-brand-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300" aria-hidden>
                                <HousePlus size={18} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
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
                          className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:border-brand-200 transition-all duration-200 ease-soft-out active:scale-[0.99]"
                        >
                          <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300" aria-hidden>
                            <HousePlus size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {rescue.org_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Donates via their own page
                            </p>
                          </div>
                          <ExternalLink size={16} aria-hidden className="text-gray-400 shrink-0" />
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
            <h2 className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-200 mb-3">
              Donation to {recipientLabel}
            </h2>
            <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Amount">
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
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
                      active
                        ? 'bg-brand-500 text-white shadow-brand-glow'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-500/10'
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
              <p className="mt-2 text-2xs text-gray-500 dark:text-gray-400">
                {config.platform_fee_percent}% supports Fetchpawz's platform costs; the
                rest goes straight to {recipientLabel}.
              </p>
            )}
            <Button
              className="w-full mt-4"
              size="lg"
              loading={submitting}
              disabled={effectiveCents == null}
              onClick={donate}
            >
              <span className="inline-flex items-center gap-2">
                <PawPrint size={18} aria-hidden />
                Donate{effectiveCents ? ` ${formatCents(effectiveCents)}` : ''}
              </span>
            </Button>
            <p className="mt-2 text-2xs text-center text-gray-400 dark:text-gray-500">
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
      <h2 className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-200 mb-2">
        Donate to a rescue
      </h2>
      <ul className="flex flex-col gap-2">
        {donating.map((rescue) => (
          <li key={rescue.id}>
            <a
              href={rescue.donation_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 hover:border-brand-200 transition-all duration-200 ease-soft-out"
            >
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300" aria-hidden>
                <HousePlus size={18} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {rescue.org_name}
              </span>
              <ExternalLink size={16} aria-hidden className="text-gray-400 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
