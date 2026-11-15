import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../components/ui/PageHeader';
import PawSpinner from '../components/flair/PawSpinner';
import { createPark, getPark, updatePark } from '../api/parks';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { useAuth } from '../store/AuthContext';

// Inline text link: navy ink on an orange underline.
const LINK =
  'font-bold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';

const PARK_ATTRIBUTES = [
  'fenced', 'off_leash_legal', 'water', 'shade',
  'small_dog_area', 'lights', 'restrooms', 'parking',
];

export default function ParkEditorPage() {
  const { id: parkId } = useParams<{ id?: string }>();
  const isEditing = Boolean(parkId);
  useDocumentTitle(`${isEditing ? 'Edit park' : 'Add a park'} · Fetchpawz`);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [attrs, setAttrs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (!parkId) return;
    getPark(parkId)
      .then((park) => {
        setName(park.name);
        setAddress(park.address ?? '');
        setLat(park.lat.toString());
        setLng(park.lng.toString());
        setAttrs(park.attributes ?? {});
      })
      .catch(() => toast.error('Failed to load park'))
      .finally(() => setLoading(false));
  }, [parkId]);

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

  const toggleAttr = (key: string) => {
    setAttrs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lat || !lng) {
      toast.error('Name and location are required');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && parkId) {
        await updatePark(parkId, {
          name: name.trim(),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: address.trim() || undefined,
          attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        });
        toast.success('Park updated');
        navigate(`/app/parks/${parkId}`);
      } else {
        const park = await createPark({
          name: name.trim(),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          address: address.trim() || undefined,
          attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        });
        toast.success('Park submitted for review');
        navigate(`/app/parks/${park.id}`);
      }
    } catch {
      toast.error(isEditing ? 'Failed to update park' : 'Failed to add park');
    } finally {
      setSaving(false);
    }
  };

  // The park library is curated: creating and editing are staff actions on the
  // server. Anyone else who lands here (an old link, a typed URL) gets told
  // how to get a park added instead of a form whose Save can only fail.
  if (user && user.role !== 'admin') {
    return (
      <div className="p-4">
        <PageHeader
          back
          backFallback={isEditing ? `/app/parks/${parkId}` : '/app/parks'}
          title="Parks are added by our team"
          subtitle={
            <>
              Spotted a park we&rsquo;re missing, or a detail that&rsquo;s wrong?{' '}
              <Link to="/app/support" className={LINK}>
                Tell us
              </Link>{' '}
              and we&rsquo;ll update it for everyone.
            </>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <PawSpinner label="Loading…" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageHeader
        back
        backFallback={isEditing ? `/app/parks/${parkId}` : '/app/parks'}
        title={isEditing ? 'Edit park' : 'Add a pet park'}
        subtitle={
          isEditing
            ? undefined
            : 'Parks you add here are marked verified and appear for everyone right away.'
        }
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Park name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="flex flex-col gap-2" role="group" aria-labelledby="park-editor-location-label">
          <span id="park-editor-location-label" className="field-label">Location</span>
          <Button type="button" variant="secondary" size="sm" onClick={handleGetLocation}>
            Use my location
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
            <Input label="Longitude" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span id="park-editor-amenities-label" className="field-label mb-1">Amenities</span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="park-editor-amenities-label">
            {PARK_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                type="button"
                onClick={() => toggleAttr(attr)}
                aria-pressed={!!attrs[attr]}
                className={`chip ${attrs[attr] ? 'chip-on' : 'hover:bg-gray-50 dark:hover:bg-night-surface'}`}
              >
                {attr.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" loading={saving} className="w-full">
          {isEditing ? 'Save changes' : 'Submit park'}
        </Button>
      </form>
    </div>
  );
}
