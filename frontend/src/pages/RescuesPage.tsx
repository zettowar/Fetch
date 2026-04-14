import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listRescues, getMyRescues, submitRescue, type Rescue } from '../api/rescues';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Spinner } from '../components/ui/Skeleton';

type Tab = 'all' | 'mine';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isFeatured(rescue: Rescue): boolean {
  return !!rescue.featured_until && new Date(rescue.featured_until) > new Date();
}

// ─── Submit modal ────────────────────────────────────────────────────────────

function SubmitModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '', description: '', location: '', website: '', donation_url: '',
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  const { mutate, isPending } = useMutation({
    mutationFn: submitRescue,
    onSuccess: () => {
      toast.success('Submitted! We\'ll review it shortly.');
      queryClient.invalidateQueries({ queryKey: ['rescues-mine'] });
      onClose();
    },
    onError: () => toast.error('Submission failed — please try again'),
  });

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors((err) => ({ ...err, [field]: undefined }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Partial<typeof form> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim() || undefined,
      website: form.website.trim() || undefined,
      donation_url: form.donation_url.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[420px] bg-white rounded-t-3xl p-6 pb-8 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Submit a Rescue Org</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Submissions are reviewed by our team before appearing publicly. You can track your submission in the "My Submissions" tab.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Organization name"
            value={form.name}
            onChange={set('name')}
            error={errors.name}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              className={`w-full border rounded-xl px-3 py-2 text-sm outline-none transition-colors ${
                errors.description
                  ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-200'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
              }`}
              placeholder="What does this organization do?"
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description}</p>
            )}
          </div>
          <Input label="Location (optional)" value={form.location} onChange={set('location')} />
          <Input
            label="Website (optional)"
            value={form.website}
            onChange={set('website')}
            type="url"
            placeholder="https://example.org"
          />
          <Input
            label="Donation link (optional)"
            value={form.donation_url}
            onChange={set('donation_url')}
            type="url"
            placeholder="https://donate.example.org"
          />
          <div className="flex gap-2 mt-2">
            <Button type="submit" loading={isPending} className="flex-1">Submit for Review</Button>
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rescue card ─────────────────────────────────────────────────────────────

function RescueCard({ rescue }: { rescue: Rescue }) {
  const featured = isFeatured(rescue);

  return (
    <div className={`bg-white rounded-2xl border p-4 ${featured ? 'border-brand-200 shadow-sm' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{rescue.name}</h3>
            {featured && (
              <span className="text-[10px] bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                Featured
              </span>
            )}
            {rescue.verified && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Verified
              </span>
            )}
          </div>
          {rescue.location && (
            <p className="text-xs text-gray-400 mt-0.5">{rescue.location}</p>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 line-clamp-3">{rescue.description}</p>

      {(rescue.website || rescue.donation_url) && (
        <div className="flex items-center gap-2 mt-3">
          {rescue.donation_url && (
            <a
              href={rescue.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-xl transition-colors"
            >
              Donate
            </a>
          )}
          {rescue.website && (
            <a
              href={rescue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
            >
              Website
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function MyRescueCard({ rescue }: { rescue: Rescue }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{rescue.name}</h3>
          {rescue.location && (
            <p className="text-xs text-gray-400 mt-0.5">{rescue.location}</p>
          )}
        </div>
        {rescue.verified ? (
          <span className="flex-shrink-0 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Verified
          </span>
        ) : (
          <span className="flex-shrink-0 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Pending Review
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{rescue.description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RescuesPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: rescues = [], isLoading: loadingAll } = useQuery({
    queryKey: ['rescues'],
    queryFn: listRescues,
  });

  const { data: myRescues = [], isLoading: loadingMine } = useQuery({
    queryKey: ['rescues-mine'],
    queryFn: getMyRescues,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rescues;
    const q = search.toLowerCase();
    return rescues.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q),
    );
  }, [rescues, search]);

  const pendingCount = useMemo(
    () => myRescues.filter((r) => !r.verified).length,
    [myRescues],
  );

  return (
    <div className="p-4 pb-8">
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Rescue Organizations</h1>
        <Button size="sm" onClick={() => setShowSubmit(true)}>
          + Submit
        </Button>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Verified organizations helping dogs find forever homes.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Rescues
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === 'mine' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          My Submissions
          {pendingCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'mine' ? 'bg-white/30 text-white' : 'bg-amber-400 text-white'
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* All rescues tab */}
      {tab === 'all' && (
        <>
          <div className="mb-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or location…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 bg-white"
            />
          </div>

          {loadingAll ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              {search ? (
                <>
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-medium">No results for "{search}"</p>
                  <p className="text-sm mt-1">Try a different name or location.</p>
                </>
              ) : (
                <>
                  <p className="text-4xl mb-3">🏠</p>
                  <p className="font-medium">No verified rescues yet</p>
                  <p className="text-sm mt-1">Know a rescue? Submit it above.</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((r) => <RescueCard key={r.id} rescue={r} />)}
            </div>
          )}
        </>
      )}

      {/* My submissions tab */}
      {tab === 'mine' && (
        <>
          {loadingMine ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : myRescues.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No submissions yet</p>
              <p className="text-sm mt-1">Submit a rescue organization to see it here.</p>
              <Button className="mt-4" size="sm" onClick={() => setShowSubmit(true)}>
                + Submit One
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myRescues.map((r) => <MyRescueCard key={r.id} rescue={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
