import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import BrandIcon from './brand/BrandIcon';
import Button from './ui/Button';
import Input from './ui/Input';
import { submitAdoptionInquiry } from '../api/adoption';
import { useAuth } from '../store/AuthContext';
import type { Pet } from '../types';
import { apiErrorMessage } from '../utils/apiError';

// Same field treatment as <Input>, for the select and textarea it can't render.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:hover:border-white/35 dark:focus:border-brand-400';

interface Props {
  rescueId: string;
  rescueName: string;
  pets?: Pet[];
  initialDogId?: string;
  onSubmitted?: () => void;
}

export default function AdoptionInquiryForm({
  rescueId,
  rescueName,
  pets = [],
  initialDogId,
  onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [selectedDogId, setSelectedDogId] = useState<string>(initialDogId ?? '');
  const initialDog = initialDogId ? pets.find((d) => d.id === initialDogId) : undefined;
  const [message, setMessage] = useState(
    initialDog ? `Hi! I'm interested in adopting ${initialDog.name}.` : '',
  );

  const mutation = useMutation({
    mutationFn: () =>
      submitAdoptionInquiry(rescueId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        message: message.trim(),
        pet_id: selectedDogId || null,
      }),
    onSuccess: () => {
      toast.success(`Inquiry sent to ${rescueName}`);
      setMessage('');
      setPhone('');
      onSubmitted?.();
    },
    // A 422's `detail` is an array of objects, not a string. Handing that to
    // the toast threw inside the Toaster, which sits outside the error
    // boundary, so an email the browser accepted and the server didn't
    // ("sam@gmail") blanked the page.
    onError: (err: unknown) =>
      toast.error(apiErrorMessage(err, "Couldn't send your inquiry. Try again.")),
  });

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    message.trim().length > 0 &&
    !mutation.isPending;

  return (
    <form
      className="surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-navy bg-pink-100 text-navy dark:border-white/15 dark:bg-pink-500/20 dark:text-biscuit"
          aria-hidden
        >
          <BrandIcon name="rescue" size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-navy dark:text-biscuit">
            Ask about adoption
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {rescueName} will reach out with next steps.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {pets.length > 0 && (
          <label className="block">
            <span className="field-label block mb-1.5">
              Which pet?
            </span>
            <select
              value={selectedDogId}
              onChange={(e) => setSelectedDogId(e.target.value)}
              className={`${FIELD} min-h-[48px]`}
            >
              <option value="">Any pet / general question</option>
              {pets.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        )}
        <Input
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="block">
          <span className="field-label block mb-1.5">
            Message
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            className={`${FIELD} resize-none`}
          />
          <span className="block text-2xs text-gray-500 dark:text-gray-400 mt-0.5 text-right tabular-nums">
            {message.length}/2000
          </span>
        </label>
      </div>

      <Button
        type="submit"
        variant="rescue"
        loading={mutation.isPending}
        disabled={!canSubmit}
        className="mt-4 w-full"
      >
        Send inquiry
      </Button>
    </form>
  );
}
