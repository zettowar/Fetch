/**
 * Status pill for a support ticket.
 *
 * Shared so the support list and the conversation view cannot drift. The labels
 * are deliberately not the raw enum: "in_progress" is a queue state, and what a
 * person waiting for an answer wants to read is that somebody is looking at it.
 */
const STATUS: Record<string, { label: string; className: string }> = {
  open: {
    label: 'Waiting on us',
    className: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  },
  in_progress: {
    label: 'Being looked at',
    className: 'bg-warning-100 text-warning-800 dark:bg-warning-500/15 dark:text-warning-200',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  },
  closed: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
};

export default function TicketStatusBadge({ status }: { status: string }) {
  const style = STATUS[status] ?? {
    label: status.replace('_', ' '),
    className: STATUS.closed.className,
  };
  return (
    <span
      className={`inline-block flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${style.className}`}
    >
      {style.label}
    </span>
  );
}
