import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { contactTagOwner } from '../api/tags';
import { apiErrorMessage } from '../utils/apiError';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BrandIcon from '../components/brand/BrandIcon';

interface FoundPetFormProps {
  /** Tag code from the scanned collar tag — the credential for this relay. */
  code: string;
  petName: string;
}

/**
 * The point of a collar tag: a stranger who finds a pet can tell its owner.
 *
 * Deliberately usable with no account — someone standing in the street holding
 * a loose dog is not going to sign up. The owner's email is never exposed; the
 * finder leaves their own contact details, which ride in the email body.
 *
 * The calm register: a flat panel, plain type, three fields and one orange
 * button. Sent is green — found is the real world's colour, not a party.
 */
export default function FoundPetForm({ code, petName }: FoundPetFormProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      contactTagOwner(code, {
        finder_name: name.trim(),
        finder_contact: contact.trim(),
        message: message.trim(),
      }),
  });

  const canSubmit =
    name.trim().length > 0 &&
    contact.trim().length >= 3 &&
    message.trim().length > 0 &&
    !mutation.isPending;

  if (mutation.isSuccess) {
    return (
      <section
        aria-live="polite"
        className="rounded-2xl border-2 border-green-500 bg-green-50 p-6 text-center dark:border-green-500/60 dark:bg-green-500/10"
      >
        <BrandIcon name="check" size={36} className="mx-auto text-green-700 dark:text-green-300" />
        <h2 className="mt-3 text-lg font-extrabold text-navy dark:text-biscuit">
          Message sent to {petName}&rsquo;s owner
        </h2>
        <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-200">
          They have your contact details and should be in touch shortly. Thank you
          for helping {petName} get home.
        </p>
      </section>
    );
  }

  return (
    <section className="surface p-6">
      <h2 className="font-plain text-2xl text-navy dark:text-biscuit">Found {petName}?</h2>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
        Send their owner a message. We&rsquo;ll pass on whatever contact details
        you leave below &mdash; your message goes straight to them.
      </p>

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
      >
        <Input
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
          required
        />
        <Input
          label="How they can reach you"
          placeholder="Phone number or email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="found-pet-message" className="field-label">
            Message
          </label>
          <textarea
            id="found-pet-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            required
            placeholder={`I found ${petName} near…`}
            className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400"
          />
        </div>

        {mutation.isError && (
          <p role="alert" className="text-sm font-semibold text-danger-700 dark:text-danger-300">
            {apiErrorMessage(mutation.error, "Couldn't send your message")}
          </p>
        )}

        <Button type="submit" size="lg" disabled={!canSubmit} loading={mutation.isPending}>
          Send message
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <BrandIcon name="lock" size={18} />
          Their email address stays private.
        </p>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          If {petName} needs urgent help, please also contact your local animal
          control or a vet.
        </p>
      </form>
    </section>
  );
}
