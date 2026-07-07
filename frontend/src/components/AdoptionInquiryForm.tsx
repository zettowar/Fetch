import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import Input from './ui/Input';
import { submitAdoptionInquiry } from '../api/adoption';
import { useAuth } from '../store/AuthContext';
import type { Pet } from '../types';

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
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to send inquiry';
      toast.error(detail);
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    message.trim().length > 0 &&
    !mutation.isPending;

  return (
    <form
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
        Ask about adoption
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {rescueName} will reach out with next steps.
      </p>

      <div className="space-y-3">
        {pets.length > 0 && (
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Which pet?
            </span>
            <select
              value={selectedDogId}
              onChange={(e) => setSelectedDogId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
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
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Message
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 text-right">
            {message.length}/2000
          </span>
        </label>
      </div>

      <Button
        type="submit"
        loading={mutation.isPending}
        disabled={!canSubmit}
        className="mt-4 w-full"
      >
        Send inquiry
      </Button>
    </form>
  );
}
