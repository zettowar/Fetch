import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, MapPin } from 'lucide-react';
import {
  getMyRescueProfile,
  markDogAdopted,
  transferDog,
  updateMyRescueProfile,
  uploadRescueLogo,
  uploadRescueCover,
  type RescueProfile,
} from '../api/rescues';
import {
  connectOnboard,
  getConnectStatus,
  getDonationConfig,
} from '../api/donations';
import { getMyPets } from '../api/pets';
import ImagePicker from '../components/ImagePicker';
import { normalizeImageFile } from '../utils/image';
import { listMyInquiries, updateInquiryStatus, type AdoptionInquiry } from '../api/adoption';
import BrandIcon from '../components/brand/BrandIcon';
import PetPortrait from '../components/brand/PetPortrait';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import SectionHeader from '../components/ui/SectionHeader';
import BackButton from '../components/ui/BackButton';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import type { Pet } from '../types';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { ListSkeleton } from '../components/ui/Skeleton';

// Loaded on demand: this page ships in the main bundle, and the map picker
// (with the map library behind it) is only needed once a rescue opens the
// details editor.
const LocationPicker = lazy(() => import('../components/LocationPicker'));

// Same field treatment as <Input>, for the textarea it can't render.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:hover:border-white/35 dark:focus:border-brand-400';
const CARD_TITLE = 'text-base font-extrabold text-navy dark:text-biscuit';
// Forever Pink is the rescue colour: the dashboard's pins are pink.
const RESCUE_PIN_COLOR = '#FF5C93';

export default function RescueDashboardPage() {
  useDocumentTitle('Rescue dashboard · Fetchpawz');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['rescue-profile-me'],
    queryFn: getMyRescueProfile,
    enabled: user?.role === 'rescue',
    retry: false,
  });

  const approved = profile?.status === 'approved';

  const {
    data: pets = [],
    refetch: refetchDogs,
    isLoading: petsLoading,
    isError: petsFailed,
  } = useQuery<Pet[]>({
    // Same key as every other "my pets" list: the pet editor invalidates
    // ['my-pets'] on create/edit/delete, and under a private key this
    // dashboard kept showing the old list after coming back from it.
    queryKey: ['my-pets'],
    queryFn: getMyPets,
    enabled: approved,
  });

  const {
    data: inquiries = [],
    refetch: refetchInquiries,
    isLoading: inquiriesLoading,
    isError: inquiriesFailed,
  } = useQuery<AdoptionInquiry[]>({
    queryKey: ['rescue-my-inquiries'],
    queryFn: listMyInquiries,
    enabled: approved,
  });

  if (user?.role !== 'rescue') {
    return (
      <div className="p-6">
        <BackButton fallback="/app/home" />
        <ErrorState message="This page is only for rescue accounts." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6">
        <BackButton fallback="/app/home" />
        <ErrorState message="Could not load your rescue profile." />
      </div>
    );
  }

  if (profile.status === 'pending') {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-[28px] leading-none text-navy dark:text-biscuit mb-3">Application pending</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Thanks for applying, <span className="font-extrabold text-navy dark:text-biscuit">{profile.org_name}</span>.
          Our team is reviewing your application. Once approved, you'll be able to
          post adoptable pets here.
        </p>
        <div className="surface flex items-start gap-3 p-4 text-sm text-navy dark:text-biscuit mb-4">
          <BrandIcon name="clock" size={20} className="mt-px" />
          <span>Reviews typically take 1–3 business days. We'll email you at your signup address.</span>
        </div>
      </div>
    );
  }

  if (profile.status === 'rejected') {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="font-plain text-[26px] leading-tight text-navy dark:text-biscuit mb-2">Application declined</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {profile.review_note || "We couldn't verify your application."} Please
          reach out to us with additional information if you think this is a mistake.
        </p>
      </div>
    );
  }

  const unadopted = pets.filter((d) => !d.adopted_at && d.is_active);
  const adopted = pets.filter((d) => d.adopted_at);

  return (
    // Tablet: the phone stack as a centred column. Desktop: two columns —
    // the page's own setup (public page, details, donations) on the left,
    // the day-to-day work (pets, inquiries) on the right. Settings come
    // first in the DOM on a phone, so they take the left column here too:
    // reading and tab order stay the same. `contents` keeps the phone order
    // below lg. Even halves at 1024, where 5/12 would squeeze the public
    // link and upload tiles narrower than a phone.
    <div className="p-4 pb-8 max-w-xl mx-auto sm:max-w-2xl lg:max-w-none lg:grid lg:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-x-6">
      <div className="flex items-center justify-between gap-3 mb-2 lg:col-span-2">
        <h1 className="min-w-0 text-[28px] leading-none text-navy dark:text-biscuit text-balance">{profile.org_name}</h1>
        <Link to="/app/pets/new" className="btn btn-rescue btn-sm shrink-0">
          + Post a pet
        </Link>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 lg:col-span-2">
        Pets you post here appear in the swipe feed and the adoption directory.
      </p>

      <div className="contents lg:block lg:min-w-0">
      <PublicPageCard profile={profile} />

      <ProfileDetailsCard profile={profile} />

      <ConnectDonationsCard externalDonationUrl={profile.donation_url} />
      </div>

      <div className="contents lg:block lg:min-w-0">
      <section className="mb-8">
        {/* Loading and failure get their own states. Both used to fall through
            to "No adoptable pets yet — Post your first": on every cold load,
            and for good when the request failed. */}
        <SectionHeader title={petsLoading || petsFailed ? 'Adoptable' : `Adoptable (${unadopted.length})`} />
        {petsLoading ? (
          <ListSkeleton rows={2} />
        ) : petsFailed ? (
          <ErrorState message="Couldn't load your pets." onRetry={() => refetchDogs()} />
        ) : unadopted.length === 0 ? (
          <EmptyState
            illustration="sleeping"
            title="No adoptable pets yet"
            body={
              <>
                <Link
                  to="/app/pets/new"
                  className="font-extrabold text-navy underline decoration-pink-500 decoration-2 underline-offset-2 dark:text-biscuit"
                >
                  Post your first
                </Link>{' '}
                to get started.
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {unadopted.map((d) => (
              <AdoptableDogRow
                key={d.id}
                pet={d}
                onChanged={() => {
                  refetchDogs();
                  queryClient.invalidateQueries({ queryKey: ['pet', d.id] });
                }}
                onView={() => navigate(`/app/pets/${d.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeader title={inquiriesLoading || inquiriesFailed ? 'Inquiries' : `Inquiries (${inquiries.length})`} />
        {inquiriesLoading ? (
          <ListSkeleton rows={2} />
        ) : inquiriesFailed ? (
          <ErrorState message="Couldn't load your inquiries." onRetry={() => refetchInquiries()} />
        ) : inquiries.length === 0 ? (
          <EmptyState
            illustration="sleeping"
            title="No adoption inquiries yet"
            body="They'll show up here when someone reaches out from your rescue page."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {inquiries.map((q) => (
              <InquiryRow key={q.id} inquiry={q} pets={pets} onChanged={refetchInquiries} />
            ))}
          </div>
        )}
      </section>

      {adopted.length > 0 && (
        <section>
          <SectionHeader title={`Adopted (${adopted.length})`} />
          <div className="flex flex-col gap-2">
            {adopted.map((d) => (
              <div
                key={d.id}
                className="surface flex items-center gap-3 p-3"
              >
                {d.primary_photo_url ? (
                  <img
                    src={d.primary_photo_url}
                    alt={d.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-navy dark:border-white/15"
                  />
                ) : (
                  <PetPortrait
                    species={d.species}
                    breed={d.breed_display}
                    seed={d.id}
                    crop="face"
                    background
                    className="w-10 h-10 shrink-0 rounded-full border-2 border-navy dark:border-white/15"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-navy dark:text-biscuit truncate">{d.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Adopted {d.adopted_at ? new Date(d.adopted_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function AdoptableDogRow({
  pet,
  onChanged,
  onView,
}: {
  pet: Pet;
  onChanged: () => void;
  onView: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'transfer'>('idle');
  const [email, setEmail] = useState('');
  const markAdopted = useMutation({
    mutationFn: () => markDogAdopted(pet.id),
    onSuccess: () => {
      toast.success(`${pet.name} marked adopted`);
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't mark them adopted. Try again.")),
  });
  const transfer = useMutation({
    mutationFn: () => transferDog(pet.id, { invited_email: email.trim().toLowerCase() }),
    onSuccess: () => {
      toast.success(`Transfer sent to ${email}`);
      setMode('idle');
      setEmail('');
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Transfer failed')),
  });

  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        {pet.primary_photo_url ? (
          <img
            src={pet.primary_photo_url}
            alt={pet.name}
            className="w-12 h-12 rounded-full object-cover cursor-pointer border-2 border-navy dark:border-white/15"
            onClick={onView}
          />
        ) : (
          <PetPortrait
            species={pet.species}
            breed={pet.breed_display}
            seed={pet.id}
            crop="face"
            background
            className="w-12 h-12 shrink-0 rounded-full border-2 border-navy dark:border-white/15"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-navy dark:text-biscuit truncate">{pet.name}</p>
          {pet.breed_display && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pet.breed_display}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onView}>
          View
        </Button>
      </div>
      {mode === 'idle' ? (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => setMode('transfer')}
          >
            Transfer to adopter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => {
              if (confirm(`Mark ${pet.name} as adopted? They'll stop appearing in the swipe feed.`)) {
                markAdopted.mutate();
              }
            }}
            loading={markAdopted.isPending}
          >
            Mark adopted
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <Input
            label="Adopter's email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adopter@example.com"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            They'll see a pending transfer next time they log in. If they don't
            have Fetchpawz yet, they'll see it when they sign up with this email.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="rescue"
              className="flex-1"
              onClick={() => transfer.mutate()}
              loading={transfer.isPending}
              disabled={!email.trim()}
            >
              Send transfer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setMode('idle');
                setEmail('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const STATUS_LABEL: Record<AdoptionInquiry['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
};
const STATUS_VARIANT: Record<AdoptionInquiry['status'], 'warning' | 'info' | 'neutral'> = {
  new: 'warning',
  contacted: 'info',
  closed: 'neutral',
};

function InquiryRow({
  inquiry,
  pets,
  onChanged,
}: {
  inquiry: AdoptionInquiry;
  pets: Pet[];
  onChanged: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (next: AdoptionInquiry['status']) => updateInquiryStatus(inquiry.id, next),
    onSuccess: () => {
      toast.success('Inquiry updated');
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't update the inquiry. Try again.")),
  });

  const aboutDog = inquiry.pet_id ? pets.find((d) => d.id === inquiry.pet_id) : undefined;

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold text-navy dark:text-biscuit truncate">{inquiry.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
            <a href={`mailto:${inquiry.email}`} className="font-semibold hover:underline">{inquiry.email}</a>
            {inquiry.phone && ` · ${inquiry.phone}`}
          </p>
          <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date(inquiry.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[inquiry.status]} className="flex-shrink-0">
          {STATUS_LABEL[inquiry.status]}
        </Badge>
      </div>
      {aboutDog && (
        <Link
          to={`/app/pets/${aboutDog.id}`}
          className="mt-2 inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy bg-pink-100 px-2 py-[3px] text-2xs font-extrabold text-navy hover:bg-pink-200 transition-colors dark:border-pink-300/50 dark:bg-pink-500/20 dark:text-pink-100 dark:hover:bg-pink-500/30"
        >
          About {aboutDog.name} ↗
        </Link>
      )}
      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{inquiry.message}</p>
      <div className="flex gap-2 mt-3">
        {inquiry.status !== 'contacted' && (
          <Button size="sm" variant="secondary" onClick={() => mutation.mutate('contacted')} loading={mutation.isPending}>
            Mark contacted
          </Button>
        )}
        {inquiry.status !== 'closed' && (
          <Button size="sm" variant="ghost" onClick={() => mutation.mutate('closed')} loading={mutation.isPending}>
            Close
          </Button>
        )}
        {inquiry.status === 'closed' && (
          <Button size="sm" variant="ghost" onClick={() => mutation.mutate('new')} loading={mutation.isPending}>
            Reopen
          </Button>
        )}
      </div>
    </Card>
  );
}

function PublicPageCard({ profile }: { profile: RescueProfile }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rescue-profile-me'] });
  const publicUrl = profile.slug ? `${window.location.origin}/rescue/${profile.slug}` : null;

  const visibility = useMutation({
    mutationFn: (is_public: boolean) => updateMyRescueProfile({ is_public }),
    onSuccess: (p) => {
      toast.success(p.is_public ? 'Public page is on' : 'Public page hidden');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update visibility')),
  });
  const logo = useMutation({
    mutationFn: (file: File) => uploadRescueLogo(file),
    onSuccess: () => { toast.success('Logo updated'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Logo upload failed')),
  });
  const cover = useMutation({
    mutationFn: (file: File) => uploadRescueCover(file),
    onSuccess: () => { toast.success('Cover updated'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Cover upload failed')),
  });

  return (
    <Card padding="md" className="mb-8">
      <div className="flex items-center justify-between gap-2">
        <h2 className={CARD_TITLE}>Your public page</h2>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={profile.is_public}
            disabled={visibility.isPending}
            onChange={(e) => visibility.mutate(e.target.checked)}
            className="h-4 w-4 accent-brand-500"
          />
          Visible
        </label>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
        A free website for your rescue — logo, description, and adoptable pets.
      </p>

      {publicUrl && (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-gray-200 bg-biscuit px-2 py-1.5 font-mono text-xs text-gray-700 dark:border-white/10 dark:bg-night dark:text-gray-200">
            {publicUrl}
          </code>
          <Button size="sm" variant="secondary" onClick={() => {
            navigator.clipboard?.writeText(publicUrl);
            toast.success('Link copied');
          }}>
            Copy
          </Button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            View ↗
          </a>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <ImageUploadTile
          label="Logo"
          url={profile.logo_url}
          pending={logo.isPending}
          onSelect={(f) => logo.mutate(f)}
          className="aspect-square"
        />
        <ImageUploadTile
          label="Cover"
          url={profile.cover_url}
          pending={cover.isPending}
          onSelect={(f) => cover.mutate(f)}
          className="aspect-[3/1] col-span-2 sm:col-span-1 sm:aspect-square"
        />
      </div>
    </Card>
  );
}

/**
 * The rescue's own details: description, location, links, and its pin on the
 * rescue map.
 *
 * None of this was editable before. Everything was typed once at signup and
 * frozen — a rescue could not fix a typo in its description or change its
 * donation link — and signup never asked for coordinates, so no rescue could
 * appear on the rescue map at all: the page it is listed on was always empty.
 */
function ProfileDetailsCard({ profile }: { profile: RescueProfile }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(profile.description);
  const [location, setLocation] = useState(profile.location ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [donationUrl, setDonationUrl] = useState(profile.donation_url ?? '');
  const savedPin =
    profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(savedPin);

  const startEditing = () => {
    // Start from what is saved, not from a previous abandoned edit.
    setDescription(profile.description);
    setLocation(profile.location ?? '');
    setWebsite(profile.website ?? '');
    setDonationUrl(profile.donation_url ?? '');
    setPin(savedPin);
    setEditing(true);
  };

  const save = useMutation({
    mutationFn: () =>
      updateMyRescueProfile({
        description: description.trim(),
        location: location.trim() || null,
        website: website.trim() || null,
        donation_url: donationUrl.trim() || null,
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
      }),
    onSuccess: () => {
      toast.success('Details saved');
      queryClient.invalidateQueries({ queryKey: ['rescue-profile-me'] });
      setEditing(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save your details')),
  });

  if (!editing) {
    return (
      <Card padding="md" className="mb-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>Your details</h2>
          <Button size="sm" variant="secondary" onClick={startEditing}>
            Edit
          </Button>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
          {profile.description}
        </p>
        <dl className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-extrabold text-navy dark:text-biscuit">Location</dt>
            <dd className="min-w-0 truncate">{profile.location || 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-extrabold text-navy dark:text-biscuit">Website</dt>
            <dd className="min-w-0 truncate">{profile.website || 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-extrabold text-navy dark:text-biscuit">Donation link</dt>
            <dd className="min-w-0 truncate">{profile.donation_url || 'Not set'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-extrabold text-navy dark:text-biscuit">Rescue map</dt>
            <dd className="min-w-0">
              {savedPin ? (
                <span className="inline-flex items-center gap-1 font-bold text-success-700 dark:text-success-300">
                  <MapPin size={12} aria-hidden /> You&rsquo;re on the map
                </span>
              ) : (
                'Not on the map yet — add a pin so nearby adopters can find you'
              )}
            </dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card padding="md" className="mb-8">
      <h2 className={`${CARD_TITLE} mb-3`}>Edit your details</h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rescue-description" className="field-label">
            Description
          </label>
          <textarea
            id="rescue-description"
            className={`${FIELD} resize-none`}
            rows={5}
            maxLength={5000}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Input
          label="Location"
          placeholder="City, province"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input
          label="Website"
          placeholder="yourrescue.org"
          maxLength={500}
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Input
          label="Donation link"
          placeholder="Where supporters can give"
          maxLength={500}
          value={donationUrl}
          onChange={(e) => setDonationUrl(e.target.value)}
        />

        <div>
          <p className="field-label">Pin on the rescue map</p>
          <p className="mt-1 mb-2 text-xs text-gray-600 dark:text-gray-300">
            Public — this is where you appear on the map adopters browse. Tap to place it
            somewhere you&rsquo;re happy to be found, such as your adoption centre.
          </p>
          <Suspense fallback={<div className="h-56 rounded-2xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-night-raised animate-pulse" aria-busy="true" />}>
            <LocationPicker value={pin} onChange={setPin} heightClass="h-56" accentColor={RESCUE_PIN_COLOR} />
          </Suspense>
          {pin && (
            <button
              type="button"
              onClick={() => setPin(null)}
              className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300 underline hover:text-danger-600 dark:hover:text-danger-300"
            >
              Remove the pin (stay off the map)
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending} disabled={!description.trim()}>
            Save details
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ImageUploadTile({
  label,
  url,
  pending,
  onSelect,
  className = '',
}: {
  label: string;
  url: string | null;
  pending: boolean;
  onSelect: (file: File) => void;
  className?: string;
}) {
  // Straight to the server, so re-encode: the picker offers the camera and
  // every format the phone can produce, the endpoint takes JPEG/PNG/WebP.
  const pick = async (file: File) => {
    try {
      onSelect(await normalizeImageFile(file));
    } catch {
      toast.error('Couldn’t read that photo — try a JPEG, PNG, or WebP.');
    }
  };

  return (
    <ImagePicker onPick={pick} disabled={pending}>
      {({ openGallery, openCamera }) => (
        <div
          className={`relative overflow-hidden rounded-lg border-2 border-dashed border-pink-400 bg-pink-50 dark:border-pink-400/40 dark:bg-pink-500/10 flex items-center justify-center ${className}`}
        >
          {url ? (
            <img src={url} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Add {label.toLowerCase()}</span>
          )}
          <div className="absolute inset-x-1 bottom-1 flex items-center justify-end gap-1">
            {pending ? (
              <span className="rounded-full bg-navy/85 px-2 py-0.5 text-2xs font-bold text-biscuit">
                Uploading…
              </span>
            ) : (
              <>
                {openCamera && (
                  <button
                    type="button"
                    onClick={openCamera}
                    aria-label={`Take a ${label.toLowerCase()} photo`}
                    className="rounded-full bg-navy/85 p-1 text-biscuit hover:bg-navy transition-colors"
                  >
                    <Camera size={13} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={openGallery}
                  className="rounded-full bg-navy/85 px-2 py-0.5 text-2xs font-bold text-biscuit hover:bg-navy transition-colors"
                >
                  {url ? `Change ${label.toLowerCase()}` : label}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </ImagePicker>
  );
}

function ConnectDonationsCard({ externalDonationUrl }: { externalDonationUrl: string | null }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const { data: config } = useQuery({
    queryKey: ['donation-config'],
    queryFn: getDonationConfig,
    staleTime: 5 * 60_000,
  });
  const { data: status } = useQuery({
    queryKey: ['connect-status'],
    queryFn: getConnectStatus,
    enabled: !!config?.enabled,
  });

  // Back from Stripe onboarding: re-sync status and greet.
  useEffect(() => {
    const connect = params.get('connect');
    if (!connect) return;
    queryClient.invalidateQueries({ queryKey: ['connect-status'] });
    if (connect === 'return') toast.success('Welcome back — checking your Stripe setup…');
    params.delete('connect');
    setParams(params, { replace: true });
  }, [params, setParams, queryClient]);

  const onboard = useMutation({
    mutationFn: connectOnboard,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not start Stripe onboarding.')),
  });

  if (!config?.enabled) return null;

  return (
    <Card padding="md" className="mb-8">
      <div className="flex items-start gap-3">
        <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-pink-100 text-navy dark:border-white/15 dark:bg-pink-500/20 dark:text-biscuit" aria-hidden>
          <BrandIcon name="donate" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={CARD_TITLE}>In-app donations</h2>
            {status?.charges_enabled ? (
              <Badge variant="success">Active</Badge>
            ) : status?.has_account ? (
              <Badge variant="warning">Onboarding incomplete</Badge>
            ) : null}
          </div>
          {status?.charges_enabled ? (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Supporters can donate to you right inside Fetchpawz. Payouts go to your
              Stripe account.
            </p>
          ) : status?.has_account ? (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {status.details_submitted
                  ? 'Stripe is reviewing your details — this usually clears quickly.'
                  : 'Finish Stripe onboarding to start receiving in-app donations.'}
              </p>
              {!status.details_submitted && (
                <Button
                  size="sm"
                  variant="rescue"
                  className="mt-2"
                  loading={onboard.isPending}
                  onClick={() => onboard.mutate()}
                >
                  Resume onboarding
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Let supporters donate without leaving Fetchpawz. Stripe handles
                identity checks and pays out straight to your bank (US accounts).
                {externalDonationUrl ? ' Your external donation link keeps working either way.' : ''}
              </p>
              <Button
                size="sm"
                variant="rescue"
                className="mt-2"
                loading={onboard.isPending}
                onClick={() => onboard.mutate()}
              >
                Accept donations in-app
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
