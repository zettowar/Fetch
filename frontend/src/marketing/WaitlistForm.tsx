import { useState } from 'react';
import type { FormEvent } from 'react';
import { joinWaitlist } from '../api/waitlist';

/**
 * Email capture for the pre-launch waitlist, used across the marketing site.
 *
 * Variants match the two surfaces it sits on:
 * - `onBrand` — white controls for the brand-gradient hero and closing CTA.
 * - `neutral` — bordered input + brand button for white/gray page sections.
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
        className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          onBrand
            ? 'bg-white/15 text-white ring-1 ring-white/30'
            : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-500/30'
        } ${className}`}
      >
        <span aria-hidden>🐾</span> You're on the list — watch your inbox for an invite.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate={false}>
      <div className="flex flex-col sm:flex-row gap-2">
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
          className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-base outline-none transition-shadow ${
            onBrand
              ? 'bg-white text-gray-900 placeholder:text-gray-400 ring-1 ring-white/40 focus:ring-2 focus:ring-white'
              : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-brand-400'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className={`flex-shrink-0 rounded-xl px-6 py-3 text-base font-semibold shadow-soft-lg transition-transform duration-200 ease-soft-out hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 ${
            onBrand
              ? 'bg-white text-brand-700'
              : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          {status === 'submitting' ? 'Joining…' : 'Get an invite'}
        </button>
      </div>
      {status === 'error' && (
        <p
          role="alert"
          className={`mt-2 text-sm font-medium ${onBrand ? 'text-white/90' : 'text-danger-500'}`}
        >
          That didn't go through — check the address and try again.
        </p>
      )}
    </form>
  );
}
