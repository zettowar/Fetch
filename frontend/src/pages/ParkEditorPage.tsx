import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BackButton from '../components/ui/BackButton';
import { createPark } from '../api/parks';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const PARK_ATTRIBUTES = [
  'fenced', 'off_leash_legal', 'water', 'shade',
  'small_dog_area', 'lights', 'restrooms', 'parking',
];

export default function ParkEditorPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [attrs, setAttrs] = useState<Record<string, boolean>>({});
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
      const park = await createPark({
        name: name.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address.trim() || undefined,
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
      });
      toast.success('Park submitted for review');
      navigate(`/parks/${park.id}`);
    } catch {
      toast.error('Failed to add park');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback="/parks" />
      <h1 className="text-2xl font-bold mb-4">Add a Dog Park</h1>
      <p className="text-sm text-gray-500 mb-6">
        New parks will be reviewed before appearing publicly.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Park Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Location</label>
          <Button type="button" variant="secondary" size="sm" onClick={handleGetLocation}>
            Use My Location
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Latitude" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
            <Input label="Longitude" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {PARK_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                type="button"
                onClick={() => toggleAttr(attr)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  attrs[attr]
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {attr.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" loading={saving} className="w-full">
          Submit Park
        </Button>
      </form>
    </div>
  );
}
