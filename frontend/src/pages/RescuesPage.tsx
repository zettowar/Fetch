import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listRescues, type RescuePublic } from '../api/rescues';
import { Spinner } from '../components/ui/Skeleton';

function RescueCard({ rescue }: { rescue: RescuePublic }) {
  return (
    <Link
      to={`/rescues/${rescue.id}`}
      className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 transition-colors"
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h3 className="font-semibold text-gray-900">{rescue.org_name}</h3>
        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          Verified
        </span>
      </div>
      {rescue.location && (
        <p className="text-xs text-gray-400 mb-1.5">{rescue.location}</p>
      )}
      <p className="text-sm text-gray-600 line-clamp-3">{rescue.description}</p>
      {(rescue.website || rescue.donation_url) && (
        <div className="flex items-center gap-2 mt-3">
          {rescue.donation_url && (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Donate
            </a>
          )}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Website
            </a>
          )}
        </div>
      )}
    </Link>
  );
}

export default function RescuesPage() {
  const [search, setSearch] = useState('');
  const { data: rescues = [], isLoading } = useQuery({
    queryKey: ['rescues'],
    queryFn: () => listRescues(),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rescues;
    const q = search.toLowerCase();
    return rescues.filter(
      (r) =>
        r.org_name.toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q),
    );
  }, [rescues, search]);

  return (
    <div className="p-4 pb-8">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold">Rescue Organizations</h1>
        <Link
          to="/signup-rescue"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 whitespace-nowrap pt-1.5"
        >
          Are you a rescue?
        </Link>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Verified rescues and shelters helping dogs find forever homes.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or location…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 bg-white mb-4"
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search ? (
            <>
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium">No results for "{search}"</p>
            </>
          ) : (
            <>
              <p className="text-4xl mb-3">🏠</p>
              <p className="font-medium">No verified rescues yet</p>
              <p className="text-sm mt-1">Check back soon.</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <RescueCard key={r.id} rescue={r} />
          ))}
        </div>
      )}
    </div>
  );
}
