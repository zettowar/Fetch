import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PawPrint } from 'lucide-react';
import { contactTagOwner } from '../api/tags';
import { apiErrorMessage } from '../utils/apiError';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
        className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/40"
      >
        <PawPrint className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" aria-hidden />
        <h2 className="mt-3 text-lg font-bold tracking-tight text-green-900 dark:text-green-100">
          Message sent to {petName}&rsquo;s owner
        </h2>
        <p className="mt-1.5 text-sm text-green-800 dark:text-green-200">
          They have your contact details and should be in touch shortly. Thank you
          for helping {petName} get home.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-soft dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold tracking-tight">Found {petName}?</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Send their owner a message. We&rsquo;ll pass on whatever contact details
        you leave below &mdash; your message goes straight to them, and their
        email address stays private.
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
          <label
            htmlFor="found-pet-message"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
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
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        {mutation.isError && (
          <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">
            {apiErrorMessage(mutation.error, "Couldn't send your message")}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit} loading={mutation.isPending}>
          Send message
        </Button>
        <p className="text-2xs text-center text-gray-400 dark:text-gray-500">
          If {petName} needs urgent help, please also contact your local animal
          control or a vet.
        </p>
      </form>
    </section>
  );
}
