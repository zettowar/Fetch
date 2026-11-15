import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import { createLostReport } from '../api/lost';
import Button from '../components/ui/Button';
import LocationPicker from '../components/LocationPicker';
import { MAP_PIN } from '../components/Map';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Form controls drawn like <Input>: 2px navy line, orange focus.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';

export default function ReportFoundPage() {
  useDocumentTitle('Report a found pet · Fetchpawz');
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
      toast.error('Pin where you found the pet on the map');
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
      toast.success('Found pet report created');
      navigate(`/app/lost/${report.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't file the report. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      {/* The calm register: plain title, flat form. */}
      <PageHeader
        plain
        back
        backFallback="/app/lost"
        title="Report a found pet"
        subtitle="Help reunite a lost pet with their owner. Your account must be at least 7 days old."
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="report-found-description" className="field-label">Description</label>
          <textarea
            id="report-found-description"
            className={`resize-none ${FIELD}`}
            rows={4}
            placeholder="Describe the pet, breed, color, size, any collar or tags, where you found them..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2" role="group" aria-labelledby="report-found-location-label">
          <span id="report-found-location-label" className="field-label">Where you found them</span>
          <LocationPicker value={location} onChange={setLocation} accentColor={MAP_PIN.park} />
        </div>

        {/* Found is green — the "I can help" colour. */}
        <Button type="submit" loading={saving} className="w-full" variant="park">
          Report found pet
        </Button>
      </form>
    </div>
  );
}
