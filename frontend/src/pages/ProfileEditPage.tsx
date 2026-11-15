import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { changeEmail, changePassword, updateMe } from '../api/auth';
import { getMyBlocks, unblockUser } from '../api/social';
import { Ban } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import TimeAgo from '../components/TimeAgo';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function ProfileEditPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle('Edit profile · Fetchpawz');

  const [displayName, setDisplayName] = useState('');
  const [locationRough, setLocationRough] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [showAdoptionPrompt, setShowAdoptionPrompt] = useState(true);
  const [speciesPreference, setSpeciesPreference] = useState<'dog' | 'cat' | 'both'>('both');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name);
    setLocationRough(user.location_rough ?? '');
    setDateOfBirth(user.date_of_birth ?? '');
    setShowAdoptionPrompt(user.show_adoption_prompt ?? true);
    setSpeciesPreference(user.species_preference ?? 'both');
  }, [user]);

  if (!user) {
    return <div className="p-4 text-gray-600 dark:text-gray-300">Not signed in.</div>;
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
        species_preference: speciesPreference,
      });
      setUser(updated);
      toast.success('Profile saved');
      navigate(`/app/users/${user.id}`);
    } catch {
      toast.error('Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <PageHeader back backFallback={`/app/users/${user.id}`} title="Edit profile" className="mb-5" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-edit-email" className="field-label">
            Email
          </label>
          <input
            id="profile-edit-email"
            value={user.email}
            disabled
            className="w-full min-h-[48px] rounded-lg border-2 border-dashed border-navy/25 bg-gray-50 px-3.5 py-2.5 text-base font-semibold text-gray-500 cursor-not-allowed dark:border-white/20 dark:bg-night dark:text-gray-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Change it in the Account section below — the new address gets a
            confirmation link first.
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

        <div className="flex flex-col gap-1.5 pt-4 border-t border-gray-200 dark:border-white/10 mt-2">
          <span className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit">
            Which pets do you want to see?
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Sets your Home page. Pick one, or “Both” to switch between them there.
          </span>
          <div
            role="radiogroup"
            aria-label="Species preference"
            className="seg self-start"
          >
            {([['dog', 'Dogs'], ['cat', 'Cats'], ['both', 'Both']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={speciesPreference === val}
                onClick={() => setSpeciesPreference(val)}
                className={`px-4 ${
                  speciesPreference === val ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-4 border-t border-gray-200 dark:border-white/10 mt-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showAdoptionPrompt}
              onChange={(e) => setShowAdoptionPrompt(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-brand-500"
            />
            <span className="flex flex-col">
              <span className="text-sm font-bold text-navy dark:text-biscuit">
                Show adoption prompts
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                When you like a pet from a rescue, we'll let you know they're up
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
            onClick={() => navigate(`/app/users/${user.id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>

      <AccountSection />
      <BlockedUsersSection />
    </div>
  );
}

function AccountSection() {
  const { user, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: (tokens) => {
      // Every other session was just revoked; adopt the fresh pair so this
      // one keeps working.
      if (user) login(tokens.access_token, tokens.refresh_token, user);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed. Other sessions were signed out.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't change password")),
  });

  const emailMutation = useMutation({
    mutationFn: () => changeEmail(emailPassword, newEmail.trim()),
    onSuccess: (res) => {
      setEmailPassword('');
      setNewEmail('');
      toast.success(res.detail, { duration: 6000 });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't start the email change")),
  });

  return (
    <section className="mt-10 max-w-md">
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit flex items-center gap-2">
        <BrandIcon name="lock" size={22} /> Account
      </h2>

      <Card
        as="form"
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); passwordMutation.mutate(); }}
      >
        <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit">Change password</p>
        <PasswordInput
          label="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          showStrength
          autoComplete="new-password"
        />
        <Button type="submit" size="sm" variant="secondary" loading={passwordMutation.isPending} className="self-start">
          Update password
        </Button>
      </Card>

      <Card
        as="form"
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); emailMutation.mutate(); }}
      >
        <p className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit">Change email</p>
        <Input
          label="New email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <PasswordInput
          label="Confirm with your password"
          value={emailPassword}
          onChange={(e) => setEmailPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          We'll email a confirmation link to the new address. Nothing changes
          until it's clicked.
        </p>
        <Button type="submit" size="sm" variant="secondary" loading={emailMutation.isPending} className="self-start">
          Send confirmation
        </Button>
      </Card>
    </section>
  );
}

function BlockedUsersSection() {
  const queryClient = useQueryClient();
  const { data: blocks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-blocks'],
    queryFn: getMyBlocks,
  });
  const unblockMutation = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => {
      toast.success('Unblocked');
      queryClient.invalidateQueries({ queryKey: ['my-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: () => toast.error("Couldn't unblock right now"),
  });

  // A failed load must not read as "you've blocked no one".
  if (isError) {
    return (
      <section className="mt-8 max-w-md">
        <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit flex items-center gap-2">
          <Ban size={20} aria-hidden className="text-gray-500 dark:text-gray-400" /> Blocked users
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Couldn't load your blocked list.{' '}
          <button type="button" onClick={() => refetch()} className="link">
            Try again
          </button>
        </p>
      </section>
    );
  }
  if (isLoading || blocks.length === 0) return null;

  return (
    <section className="mt-8 max-w-md">
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit flex items-center gap-2">
        <Ban size={20} aria-hidden className="text-gray-500 dark:text-gray-400" /> Blocked users
      </h2>
      <Card as="ul" padding="none" className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
        {blocks.map((b) => (
          <li key={b.user_id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy dark:text-biscuit truncate">{b.display_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Blocked <TimeAgo value={b.blocked_at} />
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              loading={unblockMutation.isPending && unblockMutation.variables === b.user_id}
              onClick={() => unblockMutation.mutate(b.user_id)}
            >
              Unblock
            </Button>
          </li>
        ))}
      </Card>
    </section>
  );
}
