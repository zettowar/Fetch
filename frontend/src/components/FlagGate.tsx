import type { ReactNode } from 'react';
import { usePublicFlags } from '../hooks/usePublicFlags';
import type { PublicFlags } from '../api/publicSite';

/**
 * Defense-in-depth route guard for Explore sections. Hiding the sheet entry
 * doesn't block a direct URL, so gated routes render a "coming soon" screen
 * when either the master `explore_enabled` flag or the section's own flag is
 * off. Fails open (usePublicFlags defaults every flag to true).
 */
export default function FlagGate({
  flag,
  children,
}: {
  flag: keyof PublicFlags;
  children: ReactNode;
}) {
  const flags = usePublicFlags();
  if (flags.explore_enabled && flags[flag]) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <span className="text-4xl" aria-hidden>🚧</span>
      <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Coming soon</h1>
      <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">
        This section isn’t available right now. Check back soon!
      </p>
    </div>
  );
}
