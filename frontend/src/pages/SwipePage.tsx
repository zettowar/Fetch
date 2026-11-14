import SwipeDeck from '../components/SwipeDeck';
import SpeciesTabs from '../components/SpeciesTabs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function SwipePage() {
  useDocumentTitle('Rate pets · Fetchpawz');
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Rate</h1>
      <div className="flex justify-center mb-4">
        <SpeciesTabs />
      </div>
      <SwipeDeck />
    </div>
  );
}
