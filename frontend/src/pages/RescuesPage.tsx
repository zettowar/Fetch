import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listRescues, submitRescue, type Rescue } from '../api/rescues';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { ListSkeleton } from '../components/ui/Skeleton';

function RescueCard({ rescue }: { rescue: Rescue }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{rescue.name}</h3>
          {rescue.location && (
            <p className="text-xs text-gray-400 mt-0.5">{rescue.location}</p>
          )}
        </div>
        <span className="flex-shrink-0 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          Verified
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-2 line-clamp-3">{rescue.description}</p>
      <div className="flex gap-2 mt-3">
        {rescue.website && (
          <a
            href={rescue.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-500 hover:underline"
          >
            Website
          </a>
        )}
        {rescue.donation_url && (
          <a
            href={rescue.donation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1 rounded-full transition-colors"
          >
            Donate
          </a>
        )}
      </div>
    </div>
  );
}

function SubmitForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', location: '', website: '', donation_url: '' });

  const { mutate, isPending } = useMutation({
    mutationFn: submitRescue,
    onSuccess: () => {
      toast.success('Rescue submitted for review!');
      queryClient.invalidateQueries({ queryKey: ['rescues'] });
      onClose();
    },
    onError: () => toast.error('Submission failed'),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Name and description are required');
      return;
    }
    mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim() || undefined,
      website: form.website.trim() || undefined,
      donation_url: form.donation_url.trim() || undefined,
    });
  };

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-4">
      <h2 className="font-semibold text-gray-800 mb-3">Submit a Rescue Organization</h2>
      <p className="text-xs text-gray-400 mb-4">
        Submissions are reviewed by our team before appearing publicly.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input label="Organization name" value={form.name} onChange={set('name')} required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            placeholder="What does this organization do?"
          />
        </div>
        <Input label="Location (optional)" value={form.location} onChange={set('location')} />
        <Input label="Website URL (optional)" value={form.website} onChange={set('website')} type="url" />
        <Input label="Donation URL (optional)" value={form.donation_url} onChange={set('donation_url')} type="url" />
        <div className="flex gap-2 mt-1">
          <Button type="submit" loading={isPending} className="flex-1">Submit</Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </form>
    </div>
  );
}

export default function RescuesPage() {
  const [showForm, setShowForm] = useState(false);

  const { data: rescues = [], isLoading } = useQuery({
    queryKey: ['rescues'],
    queryFn: listRescues,
  });

  return (
    <div className="p-4 pb-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Rescue Organizations</h1>
        {!showForm && (
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            Submit
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Verified rescues helping dogs find forever homes.
      </p>

      {showForm && <SubmitForm onClose={() => setShowForm(false)} />}

      {isLoading && <ListSkeleton />}

      {!isLoading && rescues.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏠</p>
          <p className="font-medium">No verified rescues yet</p>
          <p className="text-sm mt-1">Know a rescue? Submit it above.</p>
        </div>
      )}

      {!isLoading && rescues.length > 0 && (
        <div className="flex flex-col gap-3">
          {rescues.map((r) => <RescueCard key={r.id} rescue={r} />)}
        </div>
      )}
    </div>
  );
}
