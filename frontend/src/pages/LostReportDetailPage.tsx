import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Image as ImageIcon, MapPin } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import { apiErrorMessage, isNotFound } from '../utils/apiError';
import TimeAgo from '../components/TimeAgo';
import Linkify from '../components/Linkify';
import {
  getLostReport,
  getSightings,
  addSighting,
  resolveLostReport,
  contactReporter,
} from '../api/lost';
import { useAuth } from '../store/AuthContext';
import ImagePicker from '../components/ImagePicker';
import { normalizeImageFile } from '../utils/image';
import { photoUrl } from '../utils/time';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { shareLink } from '../utils/shareLink';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import Map, { MAP_PIN } from '../components/Map';
import LocationPicker from '../components/LocationPicker';
import BrandIcon from '../components/brand/BrandIcon';

// Inline text link: navy ink on an orange underline (orange text fails
// contrast on white). Calm register — no colour beyond that.
const LINK =
  'font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400 resize-none';

export default function LostReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: report, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['lost-report', id],
    queryFn: () => getLostReport(id!),
    enabled: !!id,
  });

  useDocumentTitle(
    report
      ? `${report.kind === 'missing' ? 'Missing' : 'Found'}: ${report.pet_name || 'Pet'} · Fetchpawz`
      : null,
  );

  const { data: sightings = [] } = useQuery({
    queryKey: ['sightings', id],
    queryFn: () => getSightings(id!),
    enabled: !!id,
  });

  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sightLocation, setSightLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sightNote, setSightNote] = useState('');
  const [sightPhoto, setSightPhoto] = useState<File | null>(null);

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  // This one goes straight to the server, so re-encode here — the picker now
  // offers the camera (and every other image format the phone has).
  const pickSightingPhoto = async (file: File) => {
    try {
      setSightPhoto(await normalizeImageFile(file));
    } catch {
      toast.error('Couldn’t read that photo — try a JPEG, PNG, or WebP.');
    }
  };

  const resolveMutation = useMutation({
    mutationFn: () => resolveLostReport(id!),
    onSuccess: () => {
      // The calm register holds even for good news: plain, warm, no exclamation.
      toast.success(
        report?.kind === 'missing'
          ? `So glad ${report.pet_name ? `${report.pet_name} is` : "they're"} home. Anyone who sent a sighting will hear the news.`
          : 'Marked as reunited. The report is closed.',
      );
      queryClient.invalidateQueries({ queryKey: ['lost-report', id] });
    },
    onError: () => toast.error("Couldn't mark it resolved. Try again."),
  });

  const sightingMutation = useMutation({
    mutationFn: () =>
      addSighting(id!, {
        lat: sightLocation!.lat,
        lng: sightLocation!.lng,
        note: sightNote || undefined,
        seen_at: new Date().toISOString(),
        photo: sightPhoto || undefined,
      }),
    onSuccess: () => {
      toast.success('Sighting added');
      setShowSightingForm(false);
      setSightLocation(null);
      setSightNote('');
      setSightPhoto(null);
      queryClient.invalidateQueries({ queryKey: ['sightings', id] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't add the sighting. Try again.")),
  });

  const contactMutation = useMutation({
    mutationFn: () => contactReporter(id!, contactMessage),
    onSuccess: () => {
      toast.success('Message sent to reporter');
      setShowContactForm(false);
      setContactMessage('');
    },
    onError: () => toast.error("Couldn't send your message. Try again."),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState message="Couldn't load this report." onRetry={() => refetch()} />;
  }
  if (!report) return <ErrorState message="Report not found." hint={NOT_FOUND_HINT} />;

  const isOwner = user?.id === report.reporter_id;

  return (
    // Tablet: the phone stack as a centred column. Desktop: the pet (photos,
    // what happened, where) on the left; on the right the name, what you can
    // do about it, and the sightings. The three groups are `contents` below
    // lg, so the phone keeps its order. Row 2 is `1fr` so the right column's
    // two groups sit flush however tall the left column runs.
    <div className="p-4 pb-8 sm:mx-auto sm:max-w-2xl lg:max-w-none">
      <BackButton fallback="/app/lost" />

      <div className="contents lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
      <div className="contents lg:block lg:col-start-2 lg:row-start-1">
      {/* Header — the calm register: plain type, a missing badge, never red. */}
      <div className="flex items-center gap-2 mb-3">
        {report.kind === 'missing' ? (
          <Badge size="md" variant="missing">Missing</Badge>
        ) : (
          <Badge size="md" variant="success">Found</Badge>
        )}
        <Badge
          size="md"
          variant={
            report.status === 'open' ? 'warning' : report.status === 'resolved' ? 'success' : 'neutral'
          }
        >
          {report.status === 'open' ? 'Open' : report.status === 'resolved' ? 'Resolved' : 'Closed'}
        </Badge>
      </div>

      {/* The reunion. Still the calm register — Figtree, a flat green plate,
          no exclamation — but it says the one thing everyone was waiting for. */}
      {report.status === 'resolved' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-green-600 bg-green-100 p-4 text-navy dark:border-green-400/50 dark:bg-green-500/15 dark:text-biscuit">
          {/* The house with a heart — "home" in this set is the bone. */}
          <BrandIcon name="rescue" size={24} className="mt-0.5 shrink-0" style={{ '--bean': 'currentColor' } as React.CSSProperties} />
          <div>
            <p className="text-base font-extrabold">
              {report.kind === 'missing'
                ? `${report.pet_name || 'This pet'} is home safe.`
                : 'This pet is back with their family.'}
            </p>
            <p className="mt-0.5 text-sm text-navy/80 dark:text-biscuit/80">
              Thank you to everyone who looked, shared and sent a sighting.
            </p>
          </div>
        </div>
      )}

      {/* Pet info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {report.pet_name && (
            <h1 className="font-plain text-[26px] leading-tight text-navy dark:text-biscuit">{report.pet_name}</h1>
          )}
          {report.pet_breed && <p className="text-gray-600 dark:text-gray-300">{report.pet_breed}</p>}
        </div>
        <button
          onClick={() =>
            shareLink(
              // Public reports share the crawlable, logged-out-friendly page;
              // otherwise fall back to the in-app URL (owner-only utility).
              report.is_public
                ? `${window.location.origin}/lost/${id}`
                : `${window.location.origin}/app/lost/${id}`,
              `${report.kind === 'missing' ? 'Missing' : 'Found'}: ${report.pet_name || 'Pet'}`,
            )
          }
          className="btn btn-ghost btn-sm flex-shrink-0"
          title="Share report"
        >
          <BrandIcon name="share" size={18} />
          Share
        </button>
      </div>
      </div>

      <div className="contents lg:block lg:col-start-1 lg:row-start-1 lg:row-span-2">
      {/* Photos — square, like every pet photo, once there's room for two
          across; a lone photo takes the whole width instead of half. */}
      {report.photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 lg:mt-0">
          {report.photos.map((p, idx) => (
            <img
              key={p.id}
              src={photoUrl(p)}
              alt={`Photo ${idx + 1} of ${report.pet_name || 'the pet'}`}
              loading="lazy"
              className="w-full h-48 sm:h-auto sm:aspect-square sm:only:col-span-2 sm:only:aspect-[4/3] object-cover rounded-lg border border-gray-200 dark:border-white/10"
            />
          ))}
        </div>
      )}

      {/* Description */}
      <p className="mt-4 lg:first:mt-0 text-[15px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
        <Linkify>{report.description}</Linkify>
      </p>

      {/* Location */}
      {report.last_seen_lat && report.last_seen_lng && (() => {
        // Missing: the navy pin with an orange dot inside an orange search
        // area. Found: green. Never danger red for a lost pet.
        const isMissing = report.kind === 'missing';
        const pin = isMissing ? MAP_PIN.ink : MAP_PIN.park;
        const area = isMissing ? MAP_PIN.play : MAP_PIN.park;
        const radius = report.location_fuzz_m ?? 500;
        // Roughly frame the circle.
        const zoom = Math.max(11, Math.round(15 - Math.log2(radius / 250)));
        return (
          <div className="mt-4">
            <p className="text-sm font-extrabold text-navy dark:text-biscuit mb-1.5">
              {report.kind === 'missing' ? 'Last seen near' : 'Found near'}
              <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold ml-2">
                (within ~{formatRadius(radius)})
              </span>
            </p>
            <div className="h-56 sm:h-72 lg:h-80 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
              <Map
                center={[report.last_seen_lng, report.last_seen_lat]}
                zoom={zoom}
                markers={[
                  {
                    id: report.id,
                    lat: report.last_seen_lat,
                    lng: report.last_seen_lng,
                    color: pin,
                    dot: isMissing ? MAP_PIN.play : MAP_PIN.paper,
                    label: report.kind === 'missing' ? 'Last seen' : 'Found here',
                  },
                ]}
                circles={[
                  {
                    id: `${report.id}-area`,
                    lat: report.last_seen_lat,
                    lng: report.last_seen_lng,
                    radiusMeters: radius,
                    color: area,
                    fillOpacity: 0.15,
                  },
                ]}
                cooperative
                className="h-full w-full"
              />
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
        Reported <TimeAgo value={report.created_at} />
      </p>
      </div>

      {/* The rest of the right column on desktop, in the phone's order. Not
          reordered with `order-*`: keyboard focus follows the DOM, and a
          column whose tab order disagrees with what's on screen is worse
          than one where the actions sit a little lower. */}
      <div className="contents lg:flex lg:flex-col lg:col-start-2 lg:row-start-2">

      {/* Spread the word — one-tap sharing to the public page */}
      {report.is_public && report.status === 'open' && (() => {
        const publicUrl = `${window.location.origin}/lost/${id}`;
        const label = report.kind === 'missing' ? 'MISSING' : 'FOUND';
        // The calm register: plain words, no emoji, no exclamation marks.
        const line = `${label}: ${report.pet_name || 'a pet'}. Please share to help.`;
        const nextdoor = `https://nextdoor.com/sharekit/?source=fetchpawz&body=${encodeURIComponent(`${line} ${publicUrl}`)}`;
        const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;
        const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(publicUrl)}`;
        return (
          <div className="surface mt-5 p-4">
            <h3 className="text-base font-extrabold text-navy dark:text-biscuit mb-0.5">Spread the word</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              The more neighbors who see {report.pet_name || 'this pet'}, the better the odds of a reunion.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
              <a href={nextdoor} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                Nextdoor
              </a>
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                Facebook
              </a>
              <a href={twitter} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                Share to X
              </a>
              <button type="button" onClick={() => shareLink(publicUrl, line)} className="btn btn-secondary btn-sm">
                More…
              </button>
            </div>
            <p className="mt-3 text-center text-xs">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                View public page
              </a>
            </p>
          </div>
        );
      })()}

      {/* Microchip registry links */}
      <div className="mt-4 rounded-2xl border border-navy/10 bg-navy-50 p-3 text-sm dark:border-white/10 dark:bg-night-raised">
        <p className="font-extrabold text-navy dark:text-biscuit mb-1.5">Check microchip registries:</p>
        <div className="flex flex-col items-start gap-1.5">
          <a href="https://www.aaha.org/pet-microchip-lookup/" target="_blank" rel="noopener noreferrer" className={LINK}>
            AAHA Universal Pet Microchip Lookup
          </a>
          <a href="https://www.akcreunite.org/" target="_blank" rel="noopener noreferrer" className={LINK}>
            AKC Reunite
          </a>
          <a href="https://lost.petcolove.org/" target="_blank" rel="noopener noreferrer" className={LINK}>
            Petco Love Lost
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 mt-6">
        {isOwner && report.status === 'open' && (
          <Button
            variant="primary"
            onClick={() => {
              // Resolving closes the report to sightings and can't be undone.
              if (confirm('Mark this report as resolved? It will close to new sightings.')) {
                resolveMutation.mutate();
              }
            }}
            loading={resolveMutation.isPending}
            className="w-full"
          >
            Mark as resolved
          </Button>
        )}

        {!isOwner && report.status === 'open' && (
          <>
            {/* Helping is green: a sighting is the "I can help" action. */}
            <Button variant="park" onClick={() => setShowSightingForm(!showSightingForm)} className="w-full">
              <BrandIcon name="eye" size={18} className="[--bean:var(--ink)]" />
              Report a sighting
            </Button>
            <Button variant="secondary" onClick={() => setShowContactForm(!showContactForm)} className="w-full">
              <BrandIcon name="mail" size={18} />
              Contact reporter
            </Button>
          </>
        )}
      </div>

      {/* Sighting form */}
      {showSightingForm && (
        <div className="surface mt-4 p-4">
          <h3 className="text-base font-extrabold text-navy dark:text-biscuit mb-3">Add a sighting</h3>
          <div className="flex flex-col gap-3">
            {/* A map, not two number boxes. The form used to ask a passer-by
                for a latitude and a longitude; the picker starts from their
                position (if they allow it) and a tap moves the pin. */}
            <div>
              <p className="field-label mb-1.5">
                Where did you see them?
              </p>
              <LocationPicker value={sightLocation} onChange={setSightLocation} heightClass="h-56" />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                {sightLocation
                  ? 'Tap the map to move the pin.'
                  : 'Tap the map to drop a pin where you saw them.'}
              </p>
            </div>
            <Input label="Note" value={sightNote} onChange={(e) => setSightNote(e.target.value)} placeholder="Any details..." />
            <div>
              <span id="sighting-photo-label" className="field-label block mb-1.5">Photo (optional)</span>
              <ImagePicker onPick={pickSightingPhoto}>
                {({ openGallery, openCamera }) => (
                  <div className="flex items-center gap-2" role="group" aria-labelledby="sighting-photo-label">
                    {openCamera && (
                      <Button type="button" variant="secondary" size="sm" onClick={openCamera} className="flex-1">
                        <BrandIcon name="camera" size={18} />
                        Take photo
                      </Button>
                    )}
                    <Button type="button" variant="secondary" size="sm" onClick={openGallery} className="flex-1">
                      <ImageIcon size={16} aria-hidden />
                      {openCamera ? 'Choose photo' : 'Choose a photo'}
                    </Button>
                  </div>
                )}
              </ImagePicker>
              {sightPhoto && (
                <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{sightPhoto.name}</p>
              )}
            </div>
            <Button variant="park" onClick={() => sightingMutation.mutate()} loading={sightingMutation.isPending} disabled={!sightLocation}>
              Submit sighting
            </Button>
          </div>
        </div>
      )}

      {/* Contact form */}
      {showContactForm && (
        <div className="surface mt-4 p-4">
          <h3 className="text-base font-extrabold text-navy dark:text-biscuit mb-2">Contact reporter</h3>
          <textarea
            className={FIELD}
            rows={3}
            placeholder="Your message..."
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
          />
          <Button onClick={() => contactMutation.mutate()} loading={contactMutation.isPending} disabled={!contactMessage.trim()} className="w-full mt-2">
            Send message
          </Button>
        </div>
      )}

      {/* Sightings list */}
      <div className="mt-6">
        <h3 className="text-lg font-extrabold text-navy dark:text-biscuit mb-2">
          Sightings <span className="text-gray-500 dark:text-gray-400 font-bold">({sightings.length})</span>
        </h3>
        {sightings.length === 0 ? (
          // No doodle: the calm register keeps Lost & Found plain.
          <EmptyState
            icon={<BrandIcon name="eye" size={26} />}
            title="No sightings yet"
            body={
              report.status === 'open'
                ? 'Seen this pet? Use the sighting form above to help.'
                : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {sightings.map((s) => (
              <Card key={s.id} padding="sm">
                {s.photo_url && (
                  <a href={s.photo_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={s.photo_url}
                      alt="Sighting"
                      loading="lazy"
                      className="w-full max-h-60 object-cover rounded-lg border border-gray-200 dark:border-white/10 mb-2 hover:opacity-95 transition-opacity"
                    />
                  </a>
                )}
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                  {s.note ? <Linkify>{s.note}</Linkify> : 'No details'}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <TimeAgo value={s.created_at} />
                  {/* Where — the one thing a sighting is for. (Owners get the
                      true point; everyone else the published one.) */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 ${LINK}`}
                  >
                    <MapPin size={13} aria-hidden /> Open in Maps
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}

function formatRadius(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`;
  return `${m} m`;
}
