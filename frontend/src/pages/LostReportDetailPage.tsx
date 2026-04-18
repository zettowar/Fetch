import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import { Spinner } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
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
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { shareLink } from '../utils/shareLink';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function LostReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery({
    queryKey: ['lost-report', id],
    queryFn: () => getLostReport(id!),
    enabled: !!id,
  });

  useDocumentTitle(
    report
      ? `${report.kind === 'missing' ? 'Missing' : 'Found'}: ${report.dog_name || 'Dog'} · Fetch`
      : null,
  );

  const { data: sightings = [] } = useQuery({
    queryKey: ['sightings', id],
    queryFn: () => getSightings(id!),
    enabled: !!id,
  });

  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sightLat, setSightLat] = useState('');
  const [sightLng, setSightLng] = useState('');
  const [sightNote, setSightNote] = useState('');

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  const resolveMutation = useMutation({
    mutationFn: () => resolveLostReport(id!),
    onSuccess: () => {
      toast.success('Report resolved!');
      queryClient.invalidateQueries({ queryKey: ['lost-report', id] });
    },
    onError: () => toast.error('Failed to resolve'),
  });

  const sightingMutation = useMutation({
    mutationFn: () =>
      addSighting(id!, {
        lat: parseFloat(sightLat),
        lng: parseFloat(sightLng),
        note: sightNote || undefined,
        seen_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success('Sighting added!');
      setShowSightingForm(false);
      setSightLat('');
      setSightLng('');
      setSightNote('');
      queryClient.invalidateQueries({ queryKey: ['sightings', id] });
    },
    onError: () => toast.error('Failed to add sighting'),
  });

  const contactMutation = useMutation({
    mutationFn: () => contactReporter(id!, contactMessage),
    onSuccess: () => {
      toast.success('Message sent to reporter');
      setShowContactForm(false);
      setContactMessage('');
    },
    onError: () => toast.error('Failed to send message'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!report) return <ErrorState message="Report not found." />;

  const isOwner = user?.id === report.reporter_id;

  return (
    <div className="p-4 pb-8">
      <BackButton fallback="/lost" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase text-white ${
            report.kind === 'missing' ? 'bg-red-500' : 'bg-blue-500'
          }`}
        >
          {report.kind}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            report.status === 'open'
              ? 'bg-yellow-100 text-yellow-700'
              : report.status === 'resolved'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {report.status === 'open' ? 'Open' : report.status === 'resolved' ? 'Resolved' : 'Closed'}
        </span>
      </div>

      {/* Dog info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {report.dog_name && (
            <h1 className="text-2xl font-bold">{report.dog_name}</h1>
          )}
          {report.dog_breed && <p className="text-gray-500">{report.dog_breed}</p>}
        </div>
        <button
          onClick={() =>
            shareLink(
              `${window.location.origin}/lost/${id}`,
              `${report.kind === 'missing' ? 'Missing' : 'Found'}: ${report.dog_name || 'Dog'}`,
            )
          }
          className="text-xs text-gray-400 hover:text-brand-500 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          title="Share report"
        >
          Share
        </button>
      </div>

      {/* Photos */}
      {report.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {report.photos.map((p, idx) => (
            <img
              key={p.id}
              src={p.url || `/api/v1/photos/file/${p.storage_key}`}
              alt={`Photo ${idx + 1} of ${report.dog_name || 'the dog'}`}
              className="w-full h-32 object-cover rounded-lg"
            />
          ))}
        </div>
      )}

      {/* Description */}
      <p className="mt-4 text-gray-700 whitespace-pre-wrap break-words">
        <Linkify>{report.description}</Linkify>
      </p>

      {/* Location */}
      {report.last_seen_lat && report.last_seen_lng && (
        <div className="mt-3 text-sm text-gray-500">
          Last seen near: {report.last_seen_lat.toFixed(3)}, {report.last_seen_lng.toFixed(3)}
          <span className="text-xs text-gray-400 ml-1">(approximate)</span>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Reported <TimeAgo value={report.created_at} />
      </p>

      {/* Microchip registry links */}
      <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm">
        <p className="font-medium text-blue-800 mb-1">Check microchip registries:</p>
        <div className="flex flex-col gap-1">
          <a href="https://www.aaha.org/pet-microchip-lookup/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            AAHA Universal Pet Microchip Lookup
          </a>
          <a href="https://www.akcreunite.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            AKC Reunite
          </a>
          <a href="https://lost.petcolove.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Petco Love Lost
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-6">
        {isOwner && report.status === 'open' && (
          <Button
            variant="primary"
            onClick={() => resolveMutation.mutate()}
            loading={resolveMutation.isPending}
            className="w-full"
          >
            Mark as Resolved
          </Button>
        )}

        {!isOwner && report.status === 'open' && (
          <>
            <Button variant="secondary" onClick={() => setShowSightingForm(!showSightingForm)} className="w-full">
              Report a Sighting
            </Button>
            <Button variant="ghost" onClick={() => setShowContactForm(!showContactForm)} className="w-full">
              Contact Reporter
            </Button>
          </>
        )}
      </div>

      {/* Sighting form */}
      {showSightingForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold mb-2">Add Sighting</h3>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setSightLat(pos.coords.latitude.toFixed(6));
                    setSightLng(pos.coords.longitude.toFixed(6));
                  },
                  () => toast.error('Could not get location'),
                );
              }}
            >
              Use My Location
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Lat" type="number" step="any" value={sightLat} onChange={(e) => setSightLat(e.target.value)} />
              <Input label="Lng" type="number" step="any" value={sightLng} onChange={(e) => setSightLng(e.target.value)} />
            </div>
            <Input label="Note" value={sightNote} onChange={(e) => setSightNote(e.target.value)} placeholder="Any details..." />
            <Button onClick={() => sightingMutation.mutate()} loading={sightingMutation.isPending} disabled={sightLat === '' || sightLng === ''}>
              Submit Sighting
            </Button>
          </div>
        </div>
      )}

      {/* Contact form */}
      {showContactForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold mb-2">Contact Reporter</h3>
          <textarea
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 resize-none"
            rows={3}
            placeholder="Your message..."
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
          />
          <Button onClick={() => contactMutation.mutate()} loading={contactMutation.isPending} disabled={!contactMessage.trim()} className="w-full mt-2">
            Send Message
          </Button>
        </div>
      )}

      {/* Sightings list */}
      {sightings.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Sightings ({sightings.length})</h3>
          <div className="flex flex-col gap-2">
            {sightings.map((s) => (
              <div key={s.id} className="p-3 bg-white border border-gray-100 rounded-xl">
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {s.note ? <Linkify>{s.note}</Linkify> : 'No details'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {s.lat.toFixed(3)}, {s.lng.toFixed(3)} —{' '}
                  <TimeAgo value={s.created_at} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
