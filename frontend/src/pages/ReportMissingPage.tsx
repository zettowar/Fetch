import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createLostReport } from '../api/lost';
import { getMyPets } from '../api/pets';
import Button from '../components/ui/Button';
import LocationPicker from '../components/LocationPicker';
import { apiErrorMessage } from '../utils/apiError';

export default function ReportMissingPage() {
  const navigate = useNavigate();
  const { data: myDogs = [], isLoading: myDogsLoading } = useQuery({
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
      toast.error(apiErrorMessage(err, 'Failed to create report'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback="/app/lost" />
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Siren size={22} aria-hidden className="text-danger-500" /> Report Missing Pet
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Please also contact your local animal control and vet clinics.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Which pet?</label>
          {myDogsLoading ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50">
              Loading your pets…
            </div>
          ) : myDogs.length > 0 ? (
            <select
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-base"
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You haven't added a pet yet — you can still file this report without linking one.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30 resize-none"
            rows={4}
            placeholder="Describe the pet, when and where last seen, any distinguishing features..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last seen location</label>
          <LocationPicker
            value={location}
            onChange={setLocation}
            radiusMeters={radius}
            onRadiusChange={setRadius}
            accentColor="#ef4444"
          />
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Create a public share page</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Get a shareable link (with photo) to post on Nextdoor, Facebook and X and widen
              the search. The exact location is always blurred — you can turn this off anytime.
            </span>
          </span>
        </label>

        <Button type="submit" loading={saving} className="w-full" variant="danger">
          Report Missing
        </Button>
      </form>
    </div>
  );
}
