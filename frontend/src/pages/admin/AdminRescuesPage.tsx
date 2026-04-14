import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getAdminRescues, verifyRescue } from '../../api/admin';
import Button from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Skeleton';
import { relativeTime } from '../../utils/time';

export default function AdminRescuesPage() {
  const [filter, setFilter] = useState<'all' | 'unverified' | 'verified'>('unverified');
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: allRescues = [], isLoading } = useQuery({
    queryKey: ['admin-rescues'],
    queryFn: getAdminRescues,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyRescue,
    onSuccess: () => {
      toast.success('Rescue verified');
      queryClient.invalidateQueries({ queryKey: ['admin-rescues'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed'),
  });

  const rescues = filter === 'all' ? allRescues :
    filter === 'unverified' ? allRescues.filter((r) => !r.verified) :
    allRescues.filter((r) => r.verified);

  const unverifiedCount = allRescues.filter((r) => !r.verified).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Rescues</h1>

      <div className="flex gap-1 mb-4">
        {(['unverified', 'verified', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f} {f === 'unverified' && unverifiedCount > 0 ? `(${unverifiedCount})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
      ) : rescues.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {filter === 'unverified' ? 'No pending verifications.' : 'No rescues found.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {rescues.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.location || 'No location'}</p>
                </div>
                {r.verified ? (
                  <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium shrink-0">Verified</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium shrink-0">Pending</span>
                )}
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm text-gray-700 mt-2">{r.description}</p>
                  <div className="flex flex-col gap-1 mt-2 text-xs text-gray-500">
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                        {r.website}
                      </a>
                    )}
                    {r.donation_url && (
                      <a href={r.donation_url} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                        Donation page
                      </a>
                    )}
                    <span>Submitted {relativeTime(r.created_at)}</span>
                  </div>

                  {!r.verified && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Before verifying, check: Is this a legitimate organization? Does the website work? Is there a real address?
                      </p>
                      <Button size="sm" onClick={() => verifyMutation.mutate(r.id)} loading={verifyMutation.isPending}>
                        Verify Organization
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
