import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import BrandIcon from '../components/brand/BrandIcon';
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
    <div className="px-4 pt-5 pb-8 flex flex-col gap-5">
      <PageHeader
        title="Rescues"
        subtitle="Find a forever home — or the rescue that has one."
      />

      <Link to="/app/rescues/browse" className={`${TILE} bg-pink-500`}>
        <div className="min-w-0">
          <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-navy">Adoptables</p>
          <p className="text-base font-extrabold mt-0.5">Browse rescues</p>
          <p className="text-xs font-semibold text-navy mt-0.5 truncate">
            Verified rescues and their adoptable pets
          </p>
        </div>
        <div className="flex-shrink-0 w-11 h-11 rounded-full border-2 border-navy bg-white text-navy flex items-center justify-center">
          <BrandIcon name="rescue" size={22} />
        </div>
      </Link>

      <Link
        to="/app/rescues/map"
        className={`${TILE} bg-white dark:bg-night-surface dark:text-biscuit`}
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
