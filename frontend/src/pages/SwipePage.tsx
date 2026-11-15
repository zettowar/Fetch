import SwipeDeck from '../components/SwipeDeck';
import SpeciesTabs from '../components/SpeciesTabs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function SwipePage() {
  useDocumentTitle('Rate pets · Fetchpawz');
  return (
    <div className="p-4">
      {/* One title per screen, top left; the filter sits on the same line. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit">Rate</h1>
        <SpeciesTabs />
      </div>
      <SwipeDeck />
    </div>
  );
}
