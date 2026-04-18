import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { updateMe } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ProfileEditPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle('Edit profile · Fetch');

  const [displayName, setDisplayName] = useState('');
  const [locationRough, setLocationRough] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showAdoptionPrompt, setShowAdoptionPrompt] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setLocationRough(user.location_rough ?? '');
    setDateOfBirth(user.date_of_birth ?? '');
    setShowAdoptionPrompt(user.show_adoption_prompt ?? true);
  }, [user]);

  if (!user) {
    return <div className="p-4 text-gray-500">Not signed in.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMe({
        display_name: trimmed,
        location_rough: locationRough.trim() || null,
        date_of_birth: dateOfBirth || null,
        show_adoption_prompt: showAdoptionPrompt,
      });
      setUser(updated);
      toast.success('Profile saved');
      navigate(`/users/${user.id}`);
    } catch {
      toast.error('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback={`/users/${user.id}`} />
      <h1 className="text-2xl font-bold mt-2 mb-4">Edit profile</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 tracking-tight">
            Email
          </label>
          <input
            value={user.email}
            disabled
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-base text-gray-500 shadow-soft-sm cursor-not-allowed"
          />
          <p className="text-xs text-gray-400">
            Email changes aren't supported yet. Contact support if you need to change yours.
          </p>
        </div>
        <Input
          label="Location"
          value={locationRough}
          onChange={(e) => setLocationRough(e.target.value)}
          placeholder="e.g. San Francisco, CA"
          maxLength={200}
        />
        <Input
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />

        <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100 mt-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showAdoptionPrompt}
              onChange={(e) => setShowAdoptionPrompt(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">
                Show adoption prompts
              </span>
              <span className="text-xs text-gray-400">
                When you like a dog from a rescue, we'll let you know they're up
                for adoption. Turn this off if you'd rather not see it.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button type="submit" loading={saving}>Save</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/users/${user.id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
