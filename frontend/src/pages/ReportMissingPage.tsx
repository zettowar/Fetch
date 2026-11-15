import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createLostReport } from '../api/lost';
import { getMyPets } from '../api/pets';
import Button from '../components/ui/Button';
import LocationPicker from '../components/LocationPicker';
import { MAP_PIN } from '../components/Map';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Form controls drawn like <Input>: 2px navy line, orange focus.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';

export default function ReportMissingPage() {
  useDocumentTitle('Report a missing pet · Fetchpawz');
  const navigate = useNavigate();
  const { data: myDogs = [], isLoading: myDogsLoading, isError: myDogsFailed } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
  });

  const [petId, setDogId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(500); // meters
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }
    if (!location) {
      toast.error('Pin the last-seen location on the map');
      return;
    }
    setSaving(true);
    try {
      const report = await createLostReport({
        pet_id: petId || undefined,
        kind: 'missing',
        description,
        last_seen_lat: location.lat,
        last_seen_lng: location.lng,
        last_seen_at: new Date().toISOString(),
        location_fuzz_m: radius,
        is_public: isPublic,
      });
      toast.success('Missing pet report created');
      navigate(`/app/lost/${report.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't file the report. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      {/* The calm register: plain title, no siren, no red. */}
      <PageHeader
        plain
        back
        backFallback="/app/lost"
        title="Report a missing pet"
        subtitle="Please also contact your local animal control and vet clinics."
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="report-missing-pet" className="field-label">Which pet?</label>
          {myDogsLoading ? (
            <div className="rounded-lg border-2 border-dashed border-navy/15 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-500 dark:border-white/15 dark:bg-night-surface dark:text-gray-400">
              Loading your pets…
            </div>
          ) : myDogs.length > 0 ? (
            <select
              id="report-missing-pet"
              className={`min-h-[48px] ${FIELD}`}
              value={petId}
              onChange={(e) => setDogId(e.target.value)}
            >
              <option value="">Select a pet (optional)</option>
              {myDogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.breed_display ? `(${d.breed_display})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {myDogsFailed
                ? "Couldn't load your pets. You can still file this report without linking one."
                : "You haven't added a pet yet — you can still file this report without linking one."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="report-missing-description" className="field-label">Description</label>
          <textarea
            id="report-missing-description"
            className={`resize-none ${FIELD}`}
            rows={4}
            placeholder="Describe the pet, when and where last seen, any distinguishing features..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2" role="group" aria-labelledby="report-missing-location-label">
          <span id="report-missing-location-label" className="field-label">Last seen location</span>
          <LocationPicker
            value={location}
            onChange={setLocation}
            radiusMeters={radius}
            onRadiusChange={setRadius}
            accentColor={MAP_PIN.play}
          />
        </div>

        <label className="surface flex items-start gap-3 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">
            <span className="font-extrabold text-navy dark:text-biscuit">Create a public share page</span>
            <span className="block text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Get a shareable link (with photo) to post on Nextdoor, Facebook and X and widen
              the search. The exact location is always blurred — you can turn this off anytime.
            </span>
          </span>
        </label>

        {/* Not danger: a lost pet is not an error. */}
        <Button type="submit" loading={saving} className="w-full" variant="primary">
          Report missing
        </Button>
      </form>
    </div>
  );
}
