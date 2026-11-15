import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import BrandIcon from '../components/brand/BrandIcon';
import Peek from '../components/brand/Peek';
import PageHeader from '../components/ui/PageHeader';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// The rescue hub is Forever Pink's home: the lead tile is a pink plate, and
// every bean on the page is pink.
const PINK_BEAN = { '--bean': 'var(--pink)' } as CSSProperties;

// A tile you can touch: 2px Leash Navy line on the toy shadow, pressing
// down onto it (same motion as <Card interactive>).
const TILE =
  'group flex items-center justify-between gap-3 rounded-2xl border-2 border-navy p-3.5 text-navy shadow-toy-sm transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px hover:shadow-toy active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/15';

export default function RescuesHubPage() {
  useDocumentTitle('Rescues · Fetchpawz');
  return (
    // Tablet: the phone stack as a centred column (two links stretched to
    // 900px are just long). Desktop: the two doors side by side, the pink
    // lead the larger of the pair.
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5 sm:mx-auto sm:w-full sm:max-w-2xl lg:max-w-none lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-x-6">
      <PageHeader
        title="Rescues"
        subtitle="Find a forever home — or the rescue that has one."
        className="lg:col-span-2"
      />

      {/* The lead: Forever Pink with the toy box inside it. Bagel at 36px+
          rides the pattern; the small print sits on a plain white plate. */}
      <Link
        to="/app/rescues/browse"
        className="toybox-pink relative mt-9 flex flex-col gap-4 rounded-3xl border-[2.5px] border-navy bg-pink-500 p-5 text-navy shadow-toy transition-[transform,box-shadow] duration-150 ease-soft-out hover:-translate-y-px active:translate-x-[2px] active:translate-y-[3px] active:shadow-none"
      >
        <Peek id="scruff" className="right-6 h-14" />
        <p className="font-display text-[38px] leading-[0.95] text-balance">Somebody's waiting for a sofa.</p>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-navy bg-white px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-base font-extrabold">Browse rescues</p>
            <p className="text-xs font-semibold text-gray-600 truncate">Verified rescues and their adoptable pets</p>
          </div>
          <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy bg-pink-100" aria-hidden>
            <BrandIcon name="rescue" size={20} style={PINK_BEAN} />
          </span>
        </div>
      </Link>

      <Link
        to="/app/rescues/map"
        // lg:mt-9 matches the lead's room for its Peek, so the two doors'
        // top edges line up.
        className={`${TILE} bg-white dark:bg-night-surface dark:text-biscuit lg:mt-9`}
      >
        <div className="min-w-0">
          <p className="eyebrow">Nearby</p>
          <p className="text-base font-extrabold mt-0.5">Rescue map</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 truncate">
            See rescues plotted near you
          </p>
        </div>
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-pink-100 text-navy dark:bg-pink-500/20 dark:text-biscuit flex items-center justify-center">
          <BrandIcon name="explore" size={22} style={PINK_BEAN} />
        </div>
      </Link>
    </div>
  );
}
