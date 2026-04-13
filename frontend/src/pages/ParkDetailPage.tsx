import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import ErrorState from '../components/ui/ErrorState';
import { relativeTime } from '../utils/time';
import {
  getPark,
  getParkReviews,
  createParkReview,
  getParkIncidents,
  checkinPark,
} from '../api/parks';
import Button from '../components/ui/Button';

export default function ParkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: park, isLoading } = useQuery({
    queryKey: ['park', id],
    queryFn: () => getPark(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['park-reviews', id],
    queryFn: () => getParkReviews(id!),
    enabled: !!id,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['park-incidents', id],
    queryFn: () => getParkIncidents(id!),
    enabled: !!id,
  });

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [crowdLevel, setCrowdLevel] = useState('');

  const reviewMutation = useMutation({
    mutationFn: () =>
      createParkReview(id!, {
        rating,
        body: reviewBody || undefined,
        crowd_level: crowdLevel || undefined,
      }),
    onSuccess: () => {
      toast.success('Review posted!');
      setShowReviewForm(false);
      setReviewBody('');
      queryClient.invalidateQueries({ queryKey: ['park-reviews', id] });
      queryClient.invalidateQueries({ queryKey: ['park', id] });
    },
    onError: () => toast.error('Failed to post review'),
  });

  const checkinMutation = useMutation({
    mutationFn: () => checkinPark(id!),
    onSuccess: () => toast.success('Checked in!'),
    onError: () => toast.error('Failed to check in'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!park) {
    return <ErrorState message="Park not found." />;
  }

  const attrs = park.attributes || {};

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/parks" />
      <h1 className="text-2xl font-bold">{park.name}</h1>
      {park.address && <p className="text-gray-500">{park.address}</p>}
      {park.verified && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
          Verified
        </span>
      )}

      {/* Attributes */}
      {Object.keys(attrs).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(attrs).map(([key, val]) =>
            val ? (
              <span key={key} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                {key.replace(/_/g, ' ')}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 mt-4 p-3 bg-gray-50 rounded-xl">
        <div className="text-center">
          <p className="text-xl font-bold text-brand-600">
            {park.avg_rating ? park.avg_rating.toFixed(1) : '--'}
          </p>
          <p className="text-xs text-gray-500">Rating</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{park.review_count}</p>
          <p className="text-xs text-gray-500">Reviews</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <Button size="sm" onClick={() => setShowReviewForm(!showReviewForm)}>
          Write Review
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => checkinMutation.mutate()}
          loading={checkinMutation.isPending}
        >
          Check In
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/parks/${id}/edit`)}
        >
          Edit
        </Button>
      </div>

      {/* Review form */}
      {showReviewForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl flex flex-col gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                *
              </button>
            ))}
          </div>
          <select
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            value={crowdLevel}
            onChange={(e) => setCrowdLevel(e.target.value)}
          >
            <option value="">Crowd level (optional)</option>
            <option value="empty">Empty</option>
            <option value="quiet">Quiet</option>
            <option value="moderate">Moderate</option>
            <option value="busy">Busy</option>
            <option value="packed">Packed</option>
          </select>
          <textarea
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="Your review..."
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
          />
          <Button onClick={() => reviewMutation.mutate()} loading={reviewMutation.isPending}>
            Submit Review
          </Button>
        </div>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2 text-red-600">Active Warnings</h2>
          {incidents.map((inc) => (
            <div key={inc.id} className="p-3 bg-red-50 border border-red-100 rounded-xl mb-2">
              <p className="text-sm font-medium text-red-700">{inc.kind.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-600">{inc.description}</p>
              <p className="text-xs text-gray-400 mt-1">
                Expires {relativeTime(inc.expires_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Reviews */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Reviews</h2>
        {reviews.length > 0 ? (
          reviews.map((r) => (
            <div key={r.id} className="p-3 bg-white border border-gray-100 rounded-xl mb-2">
              <div className="flex justify-between">
                <p className="font-medium text-sm">{r.author_name || 'Anonymous'}</p>
                <p className="text-sm text-brand-600">{'*'.repeat(r.rating)}</p>
              </div>
              {r.body && <p className="text-sm text-gray-600 mt-1">{r.body}</p>}
              {r.crowd_level && (
                <p className="text-xs text-gray-400 mt-1">Crowd: {r.crowd_level}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
