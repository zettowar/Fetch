import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, X } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { isNotFound } from '../utils/apiError';
import Avatar from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Skeleton';
import PlayDatesSection from '../components/PlayDatesSection';
import { relativeTime } from '../utils/time';
import {
  getPark,
  getParkReviews,
  createParkReview,
  getParkIncidents,
  getParkCheckins,
  checkinPark,
  checkoutPark,
} from '../api/parks';
import { getMyPets } from '../api/pets';
import Button from '../components/ui/Button';
import Linkify from '../components/Linkify';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';

export default function ParkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: park, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['park', id],
    queryFn: () => getPark(id!),
    enabled: !!id,
  });

  useDocumentTitle(park ? `${park.name} · Fetch` : null);

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

  const { data: checkins = [] } = useQuery({
    queryKey: ['park-checkins', id],
    queryFn: () => getParkCheckins(id!),
    enabled: !!id,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const { data: myDogs = [] } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
  });

  const [showCheckinPicker, setShowCheckinPicker] = useState(false);

  const checkinMutation = useMutation({
    mutationFn: (petId: string) => checkinPark(id!, petId),
    onSuccess: () => {
      toast.success('Checked in!');
      setShowCheckinPicker(false);
      queryClient.invalidateQueries({ queryKey: ['park-checkins', id] });
    },
    onError: () => toast.error('Failed to check in'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (petId: string) => checkoutPark(id!, petId),
    onSuccess: () => {
      toast.success('Checked out');
      queryClient.invalidateQueries({ queryKey: ['park-checkins', id] });
    },
    onError: () => toast.error('Failed to check out'),
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState message="Couldn't load this park." onRetry={() => refetch()} />;
  }
  if (!park) {
    return <ErrorState message="Park not found." />;
  }

  const attrs = park.attributes || {};

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/app/parks" />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">{park.name}</h1>
        <button
          onClick={() => shareLink(`${window.location.origin}/app/parks/${id}`, `${park.name} · Fetch`)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex-shrink-0"
          title="Share park"
        >
          Share
        </button>
      </div>
      {park.address && <p className="text-gray-500 dark:text-gray-400">{park.address}</p>}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-1 text-sm text-brand-500 hover:text-brand-600 hover:underline"
      >
        <MapPin size={16} aria-hidden /> Open in Maps
      </a>
      {park.verified && (
        <Badge variant="success" size="md" className="mt-1">
          Verified
        </Badge>
      )}

      {/* Attributes */}
      {Object.keys(attrs).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(attrs).map(([key, val]) =>
            val ? (
              <Badge key={key} variant="neutral" size="md">
                {key.replace(/_/g, ' ')}
              </Badge>
            ) : null
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div className="text-center">
          <p className="text-xl font-bold text-brand-600">
            {park.avg_rating ? park.avg_rating.toFixed(1) : '--'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold">{park.review_count}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Reviews</p>
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
          onClick={() => setShowCheckinPicker(!showCheckinPicker)}
        >
          Check In
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/app/parks/${id}/edit`)}
        >
          Edit
        </Button>
      </div>

      {/* Pet picker for check-in */}
      {showCheckinPicker && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Which pet is with you?</p>
          {myDogs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              <Link to="/app/pets/new" className="text-brand-500 hover:underline">Add a pet</Link> first
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myDogs.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => checkinMutation.mutate(pet.id)}
                  disabled={checkinMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full text-sm hover:border-brand-400 transition-colors"
                >
                  {pet.primary_photo_url && (
                    <img src={pet.primary_photo_url} alt={pet.name} className="w-5 h-5 rounded-full object-cover" />
                  )}
                  {pet.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Who's here */}
      {checkins.length > 0 && (
        <div className="mt-5">
          <h2 className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">
            Pets here now <span className="text-brand-500">({checkins.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {checkins.map((ci) => {
              const isMyDog = myDogs.some((d) => d.id === ci.pet_id);
              return (
                <div
                  key={ci.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
                >
                  {ci.pet_photo_url ? (
                    <img src={ci.pet_photo_url} alt={ci.pet_name ?? 'Checked-in pet'} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <Avatar name={ci.pet_name ?? '?'} size="md" />
                  )}
                  <div>
                    <p className="text-sm font-medium leading-none">{ci.pet_name ?? 'Unknown'}</p>
                    {ci.pet_breed && <p className="text-2xs text-gray-400 dark:text-gray-500">{ci.pet_breed}</p>}
                  </div>
                  {isMyDog && ci.pet_id && (
                    <button
                      onClick={() => checkoutMutation.mutate(ci.pet_id!)}
                      className="ml-1 text-2xs text-gray-400 dark:text-gray-500 hover:text-danger-500 dark:hover:text-danger-400"
                      title="Check out"
                      aria-label="Check out of this park"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review form */}
      {showReviewForm && (
        <fieldset
          disabled={reviewMutation.isPending}
          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex flex-col gap-3 disabled:opacity-70 disabled:cursor-wait"
        >
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`text-2xl transition-colors hover:scale-110 active:scale-95 ${n <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
                aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
          </div>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
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
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm resize-none outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
            rows={3}
            placeholder="Your review..."
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
          />
          <Button onClick={() => reviewMutation.mutate()} loading={reviewMutation.isPending}>
            Submit Review
          </Button>
        </fieldset>
      )}

      {/* Play dates */}
      <PlayDatesSection parkId={id!} />

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2 text-danger-600 dark:text-danger-400">Active Warnings</h2>
          {incidents.map((inc) => (
            <div key={inc.id} className="p-3 bg-danger-50 border border-danger-100 dark:bg-danger-500/10 dark:border-danger-500/30 rounded-xl mb-2">
              <p className="text-sm font-medium text-danger-700 dark:text-danger-300">{inc.kind.replace(/_/g, ' ')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{inc.description}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
            <Card key={r.id} padding="sm" className="mb-2">
              <div className="flex justify-between">
                <p className="font-medium text-sm">{r.author_name || 'Anonymous'}</p>
                <p className="text-sm text-yellow-400 tracking-tight">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              </div>
              {r.body && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  <Linkify>{r.body}</Linkify>
                </p>
              )}
              {r.crowd_level && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Crowd: {r.crowd_level}</p>
              )}
            </Card>
          ))
        ) : (
          <EmptyState
            illustration="sleeping"
            title="No reviews yet"
            body="Be the first to rate this park."
          />
        )}
      </div>
    </div>
  );
}
