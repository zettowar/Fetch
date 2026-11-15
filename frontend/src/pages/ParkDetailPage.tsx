import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MapPin, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import { isNotFound } from '../utils/apiError';
import Avatar from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Skeleton';
import PlayDatesSection from '../components/PlayDatesSection';
import { timeUntil } from '../utils/time';
import {
  getPark,
  getParkReviews,
  createParkReview,
  getParkIncidents,
  getParkCheckins,
  checkinPark,
  checkoutPark,
} from '../api/parks';
import IncidentReporter from '../components/IncidentReporter';
import { getMyPets } from '../api/pets';
import Button from '../components/ui/Button';
import Linkify from '../components/Linkify';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { shareLink } from '../utils/shareLink';
import { useAuth } from '../store/AuthContext';
import BrandIcon from '../components/brand/BrandIcon';

// Inline text link: navy ink on an orange underline.
const LINK =
  'font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';
// Form controls drawn like <Input>: 2px navy line, orange focus.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';

export default function ParkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: park, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['park', id],
    queryFn: () => getPark(id!),
    enabled: !!id,
  });

  useDocumentTitle(park ? `${park.name} · Fetchpawz` : null);

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
    return <ErrorState message="Park not found." hint={NOT_FOUND_HINT} />;
  }

  const attrs = park.attributes || {};

  return (
    <div className="p-4 pb-8">
      <PageHeader
        back
        backFallback="/app/parks"
        title={park.name}
        action={
          <button
            onClick={() => shareLink(`${window.location.origin}/app/parks/${id}`, `${park.name} · Fetchpawz`)}
            className="btn btn-ghost btn-sm"
            title="Share park"
          >
            <BrandIcon name="share" size={18} />
            Share
          </button>
        }
      />
      {park.address && <p className="mt-1.5 text-gray-600 dark:text-gray-300">{park.address}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${park.lat},${park.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-sm ${LINK}`}
        >
          <MapPin size={16} aria-hidden /> Open in Maps
        </a>
        {park.verified && (
          <Badge variant="success" size="md">
            Verified
          </Badge>
        )}
      </div>

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
      <div className="surface flex gap-6 mt-4 px-4 py-3">
        <div className="text-center">
          <p className="font-display text-2xl leading-none text-navy dark:text-biscuit">
            {park.avg_rating ? park.avg_rating.toFixed(1) : '--'}
          </p>
          <p className="eyebrow mt-1.5">Rating</p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl leading-none text-navy dark:text-biscuit">{park.review_count}</p>
          <p className="eyebrow mt-1.5">Reviews</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {/* Check in is the park's own action (green); the orange primary is
            saved for Submit review, so a screen never shows two. */}
        <Button
          size="sm"
          variant="park"
          onClick={() => setShowCheckinPicker(!showCheckinPicker)}
        >
          <BrandIcon name="park" size={18} className="[--bean:var(--ink)]" />
          Check in
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowReviewForm(!showReviewForm)}>
          <BrandIcon name="star" size={18} />
          Write review
        </Button>
        {/* Editing a park is a staff action on the server; showing the button
            to everyone led to a form whose Save could only fail. */}
        {user?.role === 'admin' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/app/parks/${id}/edit`)}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Pet picker for check-in */}
      {showCheckinPicker && (
        <div className="surface mt-3 p-3">
          <p className="field-label mb-2">Which pet is with you?</p>
          {myDogs.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <Link to="/app/pets/new" className={LINK}>Add a pet</Link> first
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myDogs.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => checkinMutation.mutate(pet.id)}
                  disabled={checkinMutation.isPending}
                  className="btn btn-secondary btn-sm"
                >
                  {pet.primary_photo_url && (
                    <img src={pet.primary_photo_url} alt={pet.name} className="w-5 h-5 rounded-full border border-navy/20 object-cover" />
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
          <h2 className="text-lg font-extrabold text-navy dark:text-biscuit mb-2">
            Pets here now <span className="font-bold text-green-700 dark:text-green-400">({checkins.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {checkins.map((ci) => {
              const isMyDog = myDogs.some((d) => d.id === ci.pet_id);
              return (
                <div
                  key={ci.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-night-surface border border-gray-200 dark:border-white/10 rounded-2xl"
                >
                  {ci.pet_photo_url ? (
                    <img src={ci.pet_photo_url} alt={ci.pet_name ?? 'Checked-in pet'} className="w-8 h-8 rounded-full border border-navy/20 object-cover" />
                  ) : (
                    <Avatar name={ci.pet_name ?? '?'} size="md" />
                  )}
                  <div>
                    <p className="text-sm font-extrabold leading-none text-navy dark:text-biscuit">{ci.pet_name ?? 'Unknown'}</p>
                    {ci.pet_breed && <p className="mt-0.5 text-2xs text-gray-500 dark:text-gray-400">{ci.pet_breed}</p>}
                  </div>
                  {isMyDog && ci.pet_id && (
                    <button
                      onClick={() => checkoutMutation.mutate(ci.pet_id!)}
                      className="ml-1 rounded-full p-1 text-gray-500 transition-colors hover:bg-navy/5 hover:text-navy dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-biscuit"
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
          className="surface mt-4 p-4 flex flex-col gap-3 disabled:opacity-70 disabled:cursor-wait"
        >
          {/* Rating stars are navy ink — gold is earned only. */}
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`text-2xl transition-[color,transform] hover:scale-110 active:scale-95 ${n <= rating ? 'text-navy dark:text-biscuit' : 'text-gray-300 dark:text-white/20'}`}
                aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
          </div>
          <select
            className={`min-h-[48px] ${FIELD}`}
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
            className={`resize-none ${FIELD}`}
            rows={3}
            placeholder="Your review..."
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
          />
          <Button onClick={() => reviewMutation.mutate()} loading={reviewMutation.isPending}>
            Submit review
          </Button>
        </fieldset>
      )}

      {/* Play dates */}
      <PlayDatesSection parkId={id!} />

      {/* Incidents. Previously this whole section was hidden whenever the list
          was empty — and nothing could create one, so it never appeared at
          all. Now it always shows, with the control that fills it. */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-extrabold text-navy dark:text-biscuit">
            Active warnings
          </h2>
          <IncidentReporter parkId={id!} />
        </div>
        {incidents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nothing reported here in the last two weeks.
          </p>
        ) : (
          // A warning is the gold tint with navy text and a flag — never red.
          incidents.map((inc) => (
            <div key={inc.id} className="flex gap-2.5 p-3 bg-warning-100 border border-navy/15 text-navy dark:bg-warning-500/15 dark:border-warning-400/30 dark:text-biscuit rounded-2xl mb-2">
              <BrandIcon name="flag" size={20} className="mt-px [--bean:var(--ink)] dark:[--bean:var(--paper)]" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold first-letter:uppercase">{inc.kind.replace(/_/g, ' ')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">{inc.description}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  Expires {timeUntil(inc.expires_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reviews */}
      <div className="mt-6">
        <h2 className="text-lg font-extrabold text-navy dark:text-biscuit mb-2">Reviews</h2>
        {reviews.length > 0 ? (
          reviews.map((r) => (
            <Card key={r.id} padding="sm" className="mb-2">
              <div className="flex justify-between">
                <p className="text-sm font-extrabold text-navy dark:text-biscuit">{r.author_name || 'Anonymous'}</p>
                <p className="text-sm text-navy dark:text-biscuit tracking-tight">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              </div>
              {r.body && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                  <Linkify>{r.body}</Linkify>
                </p>
              )}
              {r.crowd_level && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Crowd: {r.crowd_level}</p>
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
