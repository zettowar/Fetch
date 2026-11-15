import PetPortrait from './PetPortrait';

/**
 * A pet peeking over the top edge of a card, a sheet or a rule (Brand Book,
 * the chapter heads). Place it inside a `relative` parent; it sits on the
 * parent's top edge so the edge reads as the wall it's looking over. Purely
 * decorative. Never in Lost & Found.
 */
export default function Peek({
  id,
  className = 'right-6 h-14',
}: {
  /** Portrait id from the cast (portraitIndex.ts). */
  id: string;
  /** Position and size; keep `bottom-full` semantics by not overriding top/bottom. */
  className?: string;
}) {
  return (
    <span aria-hidden className={`pointer-events-none absolute bottom-full z-0 block aspect-[140/122] ${className}`}>
      <PetPortrait id={id} crop="peek" className="block h-full w-full" />
    </span>
  );
}
