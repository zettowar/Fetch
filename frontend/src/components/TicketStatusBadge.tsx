/**
 * Status pill for a support ticket.
 *
 * Shared so the support list and the conversation view cannot drift. The labels
 * are deliberately not the raw enum: "in_progress" is a queue state, and what a
 * person waiting for an answer wants to read is that somebody is looking at it.
 *
 * Brand treatment: a white pill with a hairline, a coloured dot and two or
 * three words. The colour lives in the dot only, so a list of tickets never
 * turns into a row of coloured stripes.
 */
const STATUS: Record<string, { label: string; dot: string }> = {
  open: { label: 'Waiting on us', dot: 'bg-brand-500' },
  in_progress: { label: 'Being looked at', dot: 'bg-gold-500' },
  resolved: { label: 'Resolved', dot: 'bg-green-500' },
  closed: { label: 'Closed', dot: 'bg-gray-400 dark:bg-gray-500' },
};

export default function TicketStatusBadge({ status }: { status: string }) {
  const style = STATUS[status] ?? {
    label: status.replace('_', ' '),
    dot: STATUS.closed.dot,
  };
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold leading-none text-navy dark:border-white/15 dark:bg-night-raised dark:text-biscuit">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-navy/30 dark:ring-white/20 ${style.dot}`} />
      {style.label}
    </span>
  );
}
