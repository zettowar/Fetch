import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSectionOpen } from '../hooks/usePublicFlags';
import type { PublicFlags } from '../api/publicSite';
import PetIllustration from './flair/PetIllustration';
import { useDocumentTitle } from '../utils/useDocumentTitle';

/** What each closed section is called, for a "not yet" that says which. */
const SECTION: Partial<Record<keyof PublicFlags, { title: string; name: string }>> = {
  explore_parks_enabled: { title: 'Parks are still being sniffed out', name: 'Parks' },
  explore_pack_enabled: { title: 'The Pack is still in training', name: 'The Pack' },
  explore_donate_enabled: { title: 'Donations are almost ready', name: 'Donate' },
  explore_shop_enabled: { title: "The shop's still in the box", name: 'Shop' },
  explore_vets_enabled: { title: 'Vets are on their way', name: 'Vets' },
  explore_community_enabled: { title: 'Community is nearly open', name: 'Community' },
};

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
  return <ComingSoon flag={flag} />;
}

/**
 * The quiet moment: the sleeping doodle, one bold line that names the section,
 * one plain line, and a way out — a closed door shouldn't also be a dead end.
 */
function ComingSoon({ flag }: { flag: keyof PublicFlags }) {
  const section = SECTION[flag];
  useDocumentTitle(`${section?.name ?? 'Coming soon'} · Fetchpawz`);
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center animate-fade-in-up">
      <PetIllustration name="sleeping" className="mb-2 h-28 w-auto" />
      <p className="eyebrow">Coming soon</p>
      <h1 className="text-[26px] leading-none text-navy dark:text-biscuit text-balance">
        {section?.title ?? 'This part is still napping'}
      </h1>
      <p className="max-w-xs text-sm text-gray-600 dark:text-gray-300 text-balance">
        We're putting the finishing touches on it. It'll show up in Explore the moment it opens.
      </p>
      <Link to="/app/home" className="btn btn-secondary btn-sm mt-4">
        Back to Home
      </Link>
    </div>
  );
}
