import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createLostReport } from '../api/lost';
import { getMyDogs } from '../api/dogs';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function ReportMissingPage() {
  const navigate = useNavigate();
  const { data: myDogs = [], isLoading: myDogsLoading } = useQuery({
    queryKey: ['my-dogs'],
    queryFn: getMyDogs,
  });

  const [dogId, setDogId] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGetLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success('Location set');
      },
      () => toast.error('Could not get location'),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }
    setSaving(true);
    try {
      const report = await createLostReport({
        dog_id: dogId || undefined,
        kind: 'missing',
        description,
        last_seen_lat: lat ? parseFloat(lat) : undefined,
        last_seen_lng: lng ? parseFloat(lng) : undefined,
        last_seen_at: new Date().toISOString(),
      });
      toast.success('Missing dog report created');
      navigate(`/lost/${report.id}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create report';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback="/lost" />
      <h1 className="text-2xl font-bold mb-2">Report Missing Dog</h1>
      <p className="text-sm text-gray-500 mb-6">
        Please also contact your local animal control and vet clinics.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Which dog?</label>
          {myDogsLoading ? (
            <div className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-400 bg-gray-50">
              Loading your dogs…
            </div>
          ) : myDogs.length > 0 ? (
            <select
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-base"
              value={dogId}
              onChange={(e) => setDogId(e.target.value)}
            >
              <option value="">Select a dog (optional)</option>
              {myDogs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.breed_display ? `(${d.breed_display})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500">
              You haven't added a dog yet — you can still file this report without linking one.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none"
            rows={4}
            placeholder="Describe the dog, when and where last seen, any distinguishing features..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Last Seen Location</label>
          <Button type="button" variant="secondary" size="sm" onClick={handleGetLocation}>
            Use My Location
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="37.7749"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-122.4194"
            />
          </div>
        </div>

        <Button type="submit" loading={saving} className="w-full" variant="danger">
          Report Missing
        </Button>
      </form>
    </div>
  );
}
