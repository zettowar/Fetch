import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signupRescue } from '../api/rescues';
import { useAuth } from '../store/AuthContext';
import AuthHero from '../components/AuthHero';
import BrandIcon from '../components/brand/BrandIcon';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { apiErrorMessage } from '../utils/apiError';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// Same field treatment as <Input>, for the textareas it can't render.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 resize-none dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';
// A text link: navy ink with an orange underline.
const TEXT_LINK =
  'font-extrabold text-navy underline decoration-brand-500 decoration-2 underline-offset-2 hover:decoration-navy dark:text-biscuit dark:hover:decoration-biscuit';

export default function RescueSignupPage() {
  useDocumentTitle('Rescue sign-up · Fetchpawz');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [donationUrl, setDonationUrl] = useState('');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !description.trim()) {
      toast.error('Organization name and description are required');
      return;
    }
    setLoading(true);
    try {
      const data = await signupRescue({
        email: email.trim().toLowerCase(),
        password,
        org_name: orgName.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        donation_url: donationUrl.trim() || undefined,
        proof_details: proof.trim() || undefined,
      });
      authLogin(data.tokens.access_token, data.tokens.refresh_token, data.user);
      toast.success('Application submitted — we\'ll review it shortly.');
      navigate('/app/rescue/dashboard', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col pb-10">
      <AuthHero
        tone="purple"
        title="Rescue / Shelter Account"
        subtitle="Create a verified account so your adoptable pets can appear in Fetchpawz — with inquiry tools, a public page, and optional in-app donations. Applications are reviewed by our team; we'll reach out if we need more info."
        icon={<BrandIcon name="rescue" size={32} />}
      />

      <div className="px-5 mt-8">
        <form
          onSubmit={handleSubmit}
          className="surface w-full max-w-sm mx-auto p-5 flex flex-col gap-4"
        >
          <Input
            label="Organization email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            showStrength
          />
          <Input
            label="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rescue-signup-description" className="field-label">About your organization</label>
            <textarea
              id="rescue-signup-description"
              className={FIELD}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="What does your rescue do? Who do you serve?"
            />
          </div>
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State"
          />
          <Input
            label="Website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://your-rescue.org"
          />
          <Input
            label="Donation link"
            type="url"
            value={donationUrl}
            onChange={(e) => setDonationUrl(e.target.value)}
            placeholder="https://your-rescue.org/donate"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rescue-signup-proof" className="field-label">Proof of status (optional)</label>
            <textarea
              id="rescue-signup-proof"
              className={FIELD}
              rows={2}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder="EIN / 501(c)(3), registration number, or a link to your verification"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Helps us verify your application faster. You can add this later if needed.
            </p>
          </div>
          <Button type="submit" variant="rescue" loading={loading} size="lg" className="w-full">
            Submit application
          </Button>
        </form>

        <p className="mt-5 text-sm text-gray-600 dark:text-gray-300 text-center">
          Already have an account?{' '}
          <Link to="/login" className={TEXT_LINK}>Log in</Link>
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 text-center">
          Not a rescue?{' '}
          <Link to="/signup" className={TEXT_LINK}>Regular signup</Link>
        </p>
      </div>
    </div>
  );
}
