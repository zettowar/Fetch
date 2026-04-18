import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import { createLostReport } from '../api/lost';
import Button from '../components/ui/Button';
import LocationPicker from '../components/LocationPicker';
import { apiErrorMessage } from '../utils/apiError';

export default function ReportFoundPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }
    if (!location) {
      toast.error('Pin where you found the dog on the map');
      return;
    }
    setSaving(true);
    try {
      const report = await createLostReport({
        kind: 'found',
        description,
        last_seen_lat: location.lat,
        last_seen_lng: location.lng,
        last_seen_at: new Date().toISOString(),
      });
      toast.success('Found dog report created');
      navigate(`/lost/${report.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create report'));
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
          <label className="text-sm font-medium text-gray-700">Where you found them</label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        <Button type="submit" loading={saving} className="w-full">
          Report Found Dog
        </Button>
      </form>
    </div>
  );
}
