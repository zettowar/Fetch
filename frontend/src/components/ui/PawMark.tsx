/**
 * Fetch brand mark: a paw print inside a ringed circle.
 * Paw and ring render in `currentColor`; the circle interior is transparent
 * so the mark shows against any surface (including the brand gradient).
 */
export default function PawMark({
  className = '',
  title = 'Fetch',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Outer toes — pushed to the edges */}
      <ellipse cx="12" cy="42" rx="10" ry="14" transform="rotate(-22 12 42)" fill="currentColor" />
      <ellipse cx="88" cy="42" rx="10" ry="14" transform="rotate(22 88 42)" fill="currentColor" />
      {/* Inner toes — larger, top of mark */}
      <ellipse cx="34" cy="20" rx="12" ry="16" fill="currentColor" />
      <ellipse cx="66" cy="20" rx="12" ry="16" fill="currentColor" />
      {/* Heel pad — fills the bottom half with a soft double-notch */}
      <path
        d="M50 44
           C 22 44, 10 64, 16 80
           C 22 94, 38 98, 44 90
           C 47 86, 49 86, 50 88
           C 51 86, 53 86, 56 90
           C 62 98, 78 94, 84 80
           C 90 64, 78 44, 50 44 Z"
        fill="currentColor"
      />
    </svg>
  );
}
