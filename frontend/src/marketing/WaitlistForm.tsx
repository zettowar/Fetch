import { useState } from 'react';
import type { FormEvent } from 'react';
import { joinWaitlist } from '../api/waitlist';
import BrandIcon from '../components/brand/BrandIcon';

/**
 * Email capture for the pre-launch waitlist, used across the marketing site.
 *
 * One pill field — the email input and a navy "Get an invite" button inside a
 * white pill with a Leash Navy line. Variants match the two surfaces it sits on:
 * - `onBrand` — on a Ball Orange band, which stays orange after dark, so the
 *   pill stays white and navy in both themes; navy focus ring and messages.
 * - `neutral` — on the Biscuit page or a white panel: orange focus ring, and
 *   the pill turns Night Surface (with a Biscuit button) after dark.
 *
 * `source` tags the signup (hero / closing / news) so we can see which
 * placement converts.
 */
export default function WaitlistForm({
  source,
  variant = 'onBrand',
  className = '',
}: {
  source: string;
  variant?: 'onBrand' | 'neutral';
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const onBrand = variant === 'onBrand';
  // Dark partners only where the surface underneath goes dark too.
  const dark = onBrand
    ? { pill: '', text: '', button: '', check: '' }
    : {
        pill: 'dark:border-white/25 dark:bg-night-surface',
        text: 'dark:text-biscuit dark:placeholder:text-gray-500',
        button: 'dark:border-biscuit dark:bg-biscuit dark:text-navy dark:hover:bg-white',
        check: 'dark:text-green-400',
      };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    try {
      await joinWaitlist(email.trim(), source);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <p
        role="status"
        className={`flex items-center justify-center gap-2 rounded-3xl border-[2.5px] border-navy bg-white px-5 py-3 text-sm font-bold text-navy ${dark.pill} ${dark.text} ${className}`}
      >
        <BrandIcon name="check" size={20} className={`text-green-600 ${dark.check}`} />
        You're on the list — watch your inbox for an invite.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate={false}>
      <div
        className={`flex items-center gap-1.5 rounded-full border-[2.5px] border-navy bg-white p-1.5 pl-5 shadow-toy transition-shadow focus-within:ring-4 ${
          onBrand ? 'focus-within:ring-navy/25' : 'focus-within:ring-brand-500/30'
        } ${dark.pill}`}
      >
        <label htmlFor={`waitlist-email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`waitlist-email-${source}`}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          // The pill shows focus with its ring, so the input drops its own.
          className={`min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none focus-visible:outline-none ${dark.text}`}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className={`btn shrink-0 border-navy bg-navy text-biscuit hover:bg-navy-600 ${dark.button}`}
        >
          {status === 'submitting' ? 'Joining…' : 'Get an invite'}
        </button>
      </div>
      {status === 'error' && (
        <p
          role="alert"
          className={`mt-2 text-sm font-bold ${onBrand ? 'text-navy' : 'text-danger-700 dark:text-danger-300'}`}
        >
          That didn't go through — check the address and try again.
        </p>
      )}
    </form>
  );
}
