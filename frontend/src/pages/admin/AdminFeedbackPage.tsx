import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFeedback } from '../../api/admin';
import TimeAgo from '../../components/TimeAgo';
import { Spinner } from '../../components/ui/Skeleton';

export default function AdminFeedbackPage() {
  const [search, setSearch] = useState('');

  const { data: allFeedback = [], isLoading } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: getFeedback,
  });

  const feedback = search
    ? allFeedback.filter((f) =>
        f.body.toLowerCase().includes(search.toLowerCase()) ||
        (f.screen_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : allFeedback;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Feedback ({allFeedback.length})</h1>
      </div>

      {allFeedback.length > 5 && (
        <input
          className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-brand-500 mb-4"
          placeholder="Search feedback..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="sm" /></div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search ? 'No feedback matching your search.' : 'No feedback yet.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {feedback.map((f) => (
            <div key={f.id} className="p-3">
              <p className="text-sm text-gray-700">{f.body}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                {f.screen_name && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">{f.screen_name}</span>
                )}
                <Link to={`/users/${f.user_id}`} className="text-brand-500 hover:underline" target="_blank">
                  User
                </Link>
                <TimeAgo value={f.created_at} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
