import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import { createLostReport } from '../api/lost';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function ReportFoundPage() {
  const navigate = useNavigate();

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
        kind: 'found',
        description,
        last_seen_lat: lat ? parseFloat(lat) : undefined,
        last_seen_lng: lng ? parseFloat(lng) : undefined,
        last_seen_at: new Date().toISOString(),
      });
      toast.success('Found dog report created');
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
      <h1 className="text-2xl font-bold mb-2">Report Found Dog</h1>
      <p className="text-sm text-gray-500 mb-6">
        Help reunite a lost dog with their owner. Your account must be at least 7 days old.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none"
            rows={4}
            placeholder="Describe the dog, breed, color, size, any collar or tags, where you found them..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Where Found</label>
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
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" loading={saving} className="w-full">
          Report Found Dog
        </Button>
      </form>
    </div>
  );
}
