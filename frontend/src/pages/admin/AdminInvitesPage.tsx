import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvites, generateInvites } from '../../api/admin';
import Button from '../../components/ui/Button';
import TimeAgo from '../../components/TimeAgo';

export default function AdminInvitesPage() {
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('unused');
  const queryClient = useQueryClient();

  const { data: allInvites = [], isLoading } = useQuery({
    queryKey: ['admin-invites'],
    queryFn: getInvites,
  });

  const genMutation = useMutation({
    mutationFn: () => generateInvites(count),
    onSuccess: (data) => {
      toast.success(`Generated ${data.length} codes`);
      queryClient.invalidateQueries({ queryKey: ['admin-invites'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed'),
  });

  const invites = filter === 'all' ? allInvites :
    filter === 'unused' ? allInvites.filter((i) => !i.is_used) :
    allInvites.filter((i) => i.is_used);

  const unusedCount = allInvites.filter((i) => !i.is_used).length;
  const usedCount = allInvites.filter((i) => i.is_used).length;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied: ${code}`);
    } catch {
      toast.error('Could not copy');
    }
  };

  const copyAllUnused = async () => {
    const codes = allInvites.filter((i) => !i.is_used).map((i) => i.code).join('\n');
    try {
      await navigator.clipboard.writeText(codes);
      toast.success(`Copied ${unusedCount} codes`);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Invite Codes</h1>

      {/* Generate section */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Generate</label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
          <Button size="sm" onClick={() => genMutation.mutate()} loading={genMutation.isPending}>
            Generate
          </Button>
          {unusedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={copyAllUnused}>
              Copy all unused
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {unusedCount} unused / {usedCount} used / {allInvites.length} total
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {(['unused', 'used', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500" /></div>
      ) : invites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {filter} invite codes.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-3">
              <button
                onClick={() => copyCode(inv.code)}
                className="font-mono text-sm text-gray-700 hover:text-brand-600 transition-colors cursor-pointer"
                title="Click to copy"
              >
                {inv.code}
              </button>
              <span className="flex-1" />
              {inv.is_used ? (
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Used</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Available</span>
              )}
              <span className="text-xs text-gray-400"><TimeAgo value={inv.created_at} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
