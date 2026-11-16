import PawPrints from './brand/PawPrints';

/**
 * Kinds whose body ends on the brand's paw prints: the warm sign-off that
 * used to be a 🐾 typed into the text (Brand Book: never emoji).
 */
const SIGNED_WITH_PAW_PRINTS = new Set(['donation_thanks']);

/** Older rows still carry the emoji in their stored text. */
const PAW_EMOJI = /\s*\u{1F43E}/gu;

/**
 * One line of an inbox row. The text truncates; the paw prints sit outside
 * the truncation so the ellipsis never swallows them.
 */
export default function NotificationBody({ type, body }: { type: string; body: string }) {
  const signed = SIGNED_WITH_PAW_PRINTS.has(type);
  const text = signed ? body.replace(PAW_EMOJI, '') : body;
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
      <span className="truncate">{text}</span>
      {signed && <PawPrints className="text-brand-500" />}
    </span>
  );
}
