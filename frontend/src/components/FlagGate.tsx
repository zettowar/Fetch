import type { ReactNode } from 'react';
import { useSectionOpen } from '../hooks/usePublicFlags';
import type { PublicFlags } from '../api/publicSite';
import PetIllustration from './flair/PetIllustration';

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
  const open = useSectionOpen(flag);
  if (open) return <>{children}</>;
  return (
    // Quiet moment: the sleeping doodle, one bold line, one plain line.
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <PetIllustration name="sleeping" className="mb-2 h-28 w-auto" />
      <h1 className="text-[26px] leading-none text-navy dark:text-biscuit">Coming soon</h1>
      <p className="max-w-xs text-sm text-gray-600 dark:text-gray-300">
        This section isn’t open yet. Check back soon.
      </p>
    </div>
  );
}
