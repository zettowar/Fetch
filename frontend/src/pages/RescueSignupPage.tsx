import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { signupRescue } from '../api/rescues';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { apiErrorMessage } from '../utils/apiError';

export default function RescueSignupPage() {
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
      authLogin(
        data.tokens.access_token,
        data.tokens.refresh_token,
        { ...data.user, show_adoption_prompt: true, is_verified: false, location_rough: null, date_of_birth: null, created_at: new Date().toISOString() } as any,
      );
      toast.success('Application submitted — we\'ll review it shortly.');
      navigate('/rescue/dashboard', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-6 py-8 min-h-[80vh]">
      <h1 className="text-2xl font-bold mb-1">Rescue / Shelter Account</h1>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
        Create a verified account so your adoptable dogs can appear in Fetch.
        Applications are reviewed by our team — we'll reach out if we need more info.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">About your organization</label>
          <textarea
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none"
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Proof of status (optional)</label>
          <textarea
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none"
            rows={2}
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="EIN / 501(c)(3), registration number, or a link to your verification"
          />
          <p className="text-xs text-gray-400">
            Helps us verify your application faster. You can add this later if needed.
          </p>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Submit application
        </Button>
      </form>
      <p className="mt-6 text-sm text-gray-500 text-center">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-500 hover:underline">Log in</Link>
      </p>
      <p className="mt-1 text-sm text-gray-500 text-center">
        Not a rescue?{' '}
        <Link to="/signup" className="text-brand-500 hover:underline">Regular signup</Link>
      </p>
    </div>
  );
}
