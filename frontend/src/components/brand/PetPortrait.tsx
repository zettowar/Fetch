import { useEffect, useState, type CSSProperties } from 'react';
import { CAT_PORTRAITS, DOG_PORTRAITS, PORTRAIT_TINT } from './portraitIndex';

// The artwork (~115 KB of SVG) is its own chunk, fetched on first use, so the
// app's main bundle doesn't carry the whole cast. Until it lands, the portrait
// renders as an empty box of the same size (its tint, if `background`).
type PortraitArt = Record<string, string>;
let art: PortraitArt | null = null;
let pending: Promise<PortraitArt> | null = null;
function loadArt(): Promise<PortraitArt> {
  pending ??= import('./portraitData').then((m) => (art = m.PORTRAITS));
  return pending;
}
function usePortraitArt(): PortraitArt | null {
  const [loaded, setLoaded] = useState<PortraitArt | null>(art);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    loadArt().then((a) => live && setLoaded(a));
    return () => {
      live = false;
    };
  }, [loaded]);
  return loaded;
}

/** Keywords in a free-text breed that pick a portrait. First match wins. */
const DOG_BREEDS: [RegExp, string][] = [
  [/golden|retriever(?!.*lab)/i, 'golden'],
  [/lab(rador)?/i, 'lab'],
  [/shepherd|malinois|alsatian/i, 'shepherd'],
  [/french|frenchie/i, 'frenchie'],
  [/pug/i, 'pug'],
  [/corgi/i, 'corgi'],
  [/husky|malamute|samoyed/i, 'husky'],
  [/dachs|doxie|wiener/i, 'dachshund'],
  [/doodle|poodle|bichon|maltese|havanese/i, 'doodle'],
  [/beagle|hound(?!.*grey)|basset/i, 'beagle'],
  [/collie|sheltie|aussie|australian/i, 'collie'],
  [/shiba|akita|jindo/i, 'shiba'],
  [/boston/i, 'boston'],
  [/pit|staff|bull ?terrier|bully|boxer/i, 'pittie'],
  [/chihuahua|min ?pin|papillon/i, 'chihuahua'],
  [/schnauzer|terrier|westie|scottie/i, 'schnauzer'],
  [/dalmatian/i, 'dalmatian'],
  [/rott|doberman|dobie/i, 'rottie'],
  [/york|silky|shih|lhasa/i, 'yorkie'],
  [/pom|spitz|keeshond/i, 'pom'],
  [/bernese|mountain|newf|st\.? ?bernard/i, 'bernese'],
  [/grey ?hound|whippet|lurcher|saluki/i, 'greyhound'],
  [/cavalier|spaniel|cocker|king charles/i, 'cavalier'],
  [/mix|mutt|mystery|unknown/i, 'scruff'],
];
const CAT_BREEDS: [RegExp, string][] = [
  [/ginger|orange|marmalade/i, 'ginger'],
  [/tux/i, 'tuxedo'],
  [/calico/i, 'calico'],
  [/siamese|balinese|himalayan/i, 'siamese'],
  [/maine|norwegian|siberian/i, 'mainecoon'],
  [/persian|exotic/i, 'persian'],
  [/fold/i, 'fold'],
  [/sphynx|hairless/i, 'sphynx'],
  [/bengal|savannah|ocicat/i, 'bengal'],
  [/british|russian|chartreux|blue/i, 'british'],
  [/tortie|tortoise/i, 'tortie'],
  [/ragdoll|birman/i, 'ragdoll'],
  [/black|bombay/i, 'black'],
  [/white/i, 'white'],
  [/tabby/i, 'tabby'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Pick the portrait that best stands in for a pet: by breed keyword when
 * there is one, otherwise a stable choice from the species' cast so the same
 * pet always gets the same face.
 */
export function portraitFor(species: string | null | undefined, breed?: string | null, seed = ''): string {
  const isCat = species === 'cat';
  const table = isCat ? CAT_BREEDS : DOG_BREEDS;
  if (breed) {
    for (const [re, id] of table) if (re.test(breed)) return id;
  }
  const cast = isCat ? CAT_PORTRAITS : DOG_PORTRAITS;
  return cast[hash(seed || breed || 'pet') % cast.length][0];
}

export function portraitTint(id: string): string {
  return PORTRAIT_TINT[id] ?? '#FFE4D1';
}

/**
 * A breed portrait from the cast (Brand Book, The cast chapter). Flat fills,
 * no outline, on a 200×200 grid. Pass `id` directly, or `species` + `breed`
 * (+ `seed`, usually the pet id) to choose one. `background` paints the
 * portrait's own tint behind it.
 */
export default function PetPortrait({
  id,
  species,
  breed,
  seed,
  background = false,
  crop = 'full',
  className = '',
  title,
  style,
}: {
  id?: string;
  species?: string | null;
  breed?: string | null;
  seed?: string;
  background?: boolean;
  /** `face` crops to a circle-friendly head-and-shoulders square. */
  crop?: 'full' | 'face';
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const portraits = usePortraitArt();
  const pid = id && PORTRAIT_TINT[id] ? id : portraitFor(species, breed, seed);
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <svg
      viewBox={crop === 'face' ? '34 30 132 132' : '0 0 200 200'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={background ? { background: portraitTint(pid), ...style } : style}
      {...a11y}
      // Static, code-owned artwork generated from the brand book. The label
      // stays in aria-label (never interpolated into markup).
      dangerouslySetInnerHTML={{ __html: portraits?.[pid] ?? '' }}
    />
  );
}
