import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { createReport, type ReportTargetType } from '../api/reports';
import { apiErrorMessage, isConflict } from '../utils/apiError';
import Button from './ui/Button';
import Modal from './ui/Modal';

/** Preset categories, kept short and non-overlapping so the admin queue is
 *  sortable. The chosen label is prefixed onto the free-text detail. */
const REASONS = [
  'Inappropriate or explicit content',
  'Not a real pet / spam',
  'Harassment or abuse',
  'Animal welfare concern',
  'Impersonation or stolen photos',
  'Something else',
] as const;

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** What the user thinks they are reporting, e.g. a pet or person's name. */
  targetLabel: string;
}

export default function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: ReportDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [detail, setDetail] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createReport({
        target_type: targetType,
        target_id: targetId,
        // Backend caps reason at 500 chars.
        reason: `${reason}${detail.trim() ? ` — ${detail.trim()}` : ''}`.slice(0, 500),
      }),
    onSuccess: () => {
      toast.success('Report sent. Our team will take a look.');
      reset();
      onClose();
    },
    onError: (err) => {
      // A duplicate pending report is not really a failure — say so plainly.
      if (isConflict(err)) {
        toast('You already reported this. It is in the queue.');
        reset();
        onClose();
        return;
      }
      toast.error(apiErrorMessage(err, "Couldn't send that report"));
    },
  });

  function reset() {
    setReason(REASONS[0]);
    setDetail('');
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`Report ${targetLabel}`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-gray-600 dark:text-gray-300">
            What&rsquo;s wrong? Reports are reviewed by our team and are not
            shared with the person you&rsquo;re reporting.
          </legend>
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:has-[:checked]:bg-brand-500/10"
            >
              <input
                type="radio"
                name="report-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 accent-brand-500"
              />
              <span>{r}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="report-detail"
            className="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Anything else? <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="report-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={400}
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={mutation.isPending}
            className="flex-1"
          >
            Send report
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The affordance itself — a quiet text button, so it never competes with the
 *  primary actions on a profile or card. */
export function ReportButton({
  targetType,
  targetId,
  targetLabel,
  className = '',
}: Omit<ReportDialogProps, 'open' | 'onClose'> & { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-danger-600 dark:text-gray-500 dark:hover:text-danger-400 ${className}`}
      >
        <Flag size={13} aria-hidden />
        Report
      </button>
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={targetId}
        targetLabel={targetLabel}
      />
    </>
  );
}
