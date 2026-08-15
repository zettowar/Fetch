import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TriangleAlert } from 'lucide-react';
import { createParkIncident } from '../api/parks';
import { apiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import Modal from './ui/Modal';

/** Mirrors the backend's allowed kinds (schemas/park.py). */
const KINDS = [
  { value: 'aggressive_dog', label: 'Aggressive dog' },
  { value: 'wildlife', label: 'Wildlife' },
  { value: 'hazard', label: 'Hazard (glass, broken fence…)' },
  { value: 'other', label: 'Something else' },
] as const;

/**
 * Report a hazard at a park. `createParkIncident` shipped in the API client
 * with no caller, so the warnings section on every park page was permanently
 * empty and this safety feature did not exist for users.
 */
export default function IncidentReporter({ parkId }: { parkId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(KINDS[0].value);
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createParkIncident(parkId, { kind, description: description.trim() }),
    onSuccess: () => {
      toast.success('Thanks — the warning is up for two weeks');
      queryClient.invalidateQueries({ queryKey: ['park-incidents', parkId] });
      setDescription('');
      setKind(KINDS[0].value);
      setOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't post that warning")),
  });

  const canSubmit = description.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-danger-600 transition-colors hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300"
      >
        <TriangleAlert size={14} aria-hidden />
        Report an issue
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Report an issue">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !mutation.isPending) mutation.mutate();
          }}
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Warnings are shown to everyone viewing this park for the next two
            weeks. For anything urgent, please also call your local animal
            control.
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              What kind of issue?
            </legend>
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-50 has-[:checked]:border-danger-500 has-[:checked]:bg-danger-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:has-[:checked]:bg-danger-500/10"
              >
                <input
                  type="radio"
                  name="incident-kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="h-4 w-4 accent-danger-500"
                />
                <span>{k.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="incident-description"
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              What happened?
            </label>
            <textarea
              id="incident-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              required
              placeholder="Where in the park, and what should people watch out for?"
              className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              className="flex-1"
              disabled={!canSubmit}
              loading={mutation.isPending}
            >
              Post warning
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
