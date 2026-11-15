import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createParkIncident } from '../api/parks';
import { apiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import Modal from './ui/Modal';
import BrandIcon from './brand/BrandIcon';

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
      {/* A park warning is the gold tint and a flag, never danger red. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm flex-shrink-0"
      >
        <BrandIcon name="flag" size={18} />
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
            <legend className="field-label mb-1.5">
              What kind of issue?
            </legend>
            {KINDS.map((k) => (
              <label
                key={k.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-navy/15 bg-white px-3.5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gray-50 has-[:checked]:border-navy has-[:checked]:bg-warning-100 dark:border-white/15 dark:bg-night-surface dark:text-biscuit dark:hover:bg-night-raised dark:has-[:checked]:border-warning-400/60 dark:has-[:checked]:bg-warning-500/15"
              >
                <input
                  type="radio"
                  name="incident-kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="h-4 w-4 accent-navy dark:accent-biscuit"
                />
                <span>{k.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="incident-description"
              className="field-label"
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
              className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400 resize-none"
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
            {/* Not danger: posting a warning is neither an error nor destructive. */}
            <Button
              type="submit"
              variant="primary"
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
