import type { ReactNode } from 'react';
import type { DogIllustrationName as IllustrationName } from './DogIllustration';

interface CatIllustrationProps {
  name: IllustrationName;
  className?: string;
  title?: string;
}

/*
 * Cat companion to DogIllustration — same poses, viewBox, and stroke style so
 * the two are drop-in interchangeable by species. Cats read as cats via pointy
 * ears, whiskers, and an upright/curling tail; the brand-tinted accent group
 * (Zzz, yarn, scent, batted specks, meow arcs) mirrors the dog set.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ACCENT_STROKE = { ...STROKE, strokeWidth: 5 } as const;

const POSES: Record<IllustrationName, ReactNode> = {
  // Curled up asleep, Zzz drifting off — "nothing here yet"
  sleeping: (
    <>
      {/* curled body */}
      <path d="M42 120 C 38 94, 66 80, 100 80 C 140 80, 164 96, 160 116 C 159 124, 150 128, 138 128 L 56 128 C 46 128, 43 124, 42 120 Z" {...STROKE} />
      {/* tail wrapping around the front */}
      <path d="M58 126 C 36 124, 30 106, 46 100" {...STROKE} strokeWidth={5.5} />
      {/* head resting */}
      <circle cx="74" cy="104" r="19" {...STROKE} />
      {/* two pointy ears */}
      <path d="M60 90 L 53 73 L 71 85" {...STROKE} strokeWidth={5} />
      <path d="M88 90 L 95 73 L 77 85" {...STROKE} strokeWidth={5} />
      {/* closed eye */}
      <path d="M66 104 q6 4 12 0" {...STROKE} strokeWidth={4} />
      {/* nose + whiskers */}
      <circle cx="60" cy="110" r="3.5" fill="currentColor" stroke="none" />
      <path d="M57 108 L 40 104" {...STROKE} strokeWidth={3} />
      <path d="M57 113 L 41 116" {...STROKE} strokeWidth={3} />
      <g className="text-brand-500">
        <path d="M120 58 h12 l-12 12 h12" {...ACCENT_STROKE} strokeWidth={4} className="animate-float-up" />
        <path
          d="M142 38 h14 l-14 14 h14"
          {...ACCENT_STROKE}
          strokeWidth={4.5}
          className="animate-float-up"
          style={{ animationDelay: '0.8s' }}
        />
        <path
          d="M166 16 h16 l-16 16 h16"
          {...ACCENT_STROKE}
          strokeWidth={5}
          className="animate-float-up"
          style={{ animationDelay: '1.6s' }}
        />
      </g>
    </>
  ),

  // Crouched, rump up, one paw batting — errors & 404 ("came up with nothing")
  digging: (
    <>
      {/* ground */}
      <path d="M24 132 h152" {...STROKE} strokeWidth={4} />
      {/* crouched body sloping up to the rear */}
      <path d="M70 118 C 84 92, 120 84, 144 96" {...STROKE} />
      <path d="M78 124 C 100 116, 122 116, 140 118" {...STROKE} />
      <path d="M144 96 C 156 104, 156 120, 148 132" {...STROKE} />
      {/* head down */}
      <circle cx="60" cy="112" r="15" {...STROKE} />
      {/* pointy ears */}
      <path d="M49 100 L 44 87 L 58 96" {...STROKE} strokeWidth={5} />
      <path d="M71 100 L 76 87 L 62 96" {...STROKE} strokeWidth={5} />
      {/* front paw reaching down */}
      <path d="M56 124 L 50 132" {...STROKE} />
      {/* nose + whiskers */}
      <circle cx="47" cy="114" r="3" fill="currentColor" stroke="none" />
      <path d="M45 112 L 30 109" {...STROKE} strokeWidth={3} />
      <path d="M45 116 L 31 120" {...STROKE} strokeWidth={3} />
      {/* tail up */}
      <path d="M148 92 C 160 82, 162 66, 152 58" {...STROKE} />
      <g className="text-brand-500">
        {/* batted specks flying */}
        <path d="M34 96 q-6 -10 -2 -18" {...ACCENT_STROKE} />
        <path d="M48 90 q-2 -10 6 -14" {...ACCENT_STROKE} />
        <circle cx="26" cy="66" r="3" fill="currentColor" stroke="none" />
        <circle cx="40" cy="60" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="18" cy="84" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  // Sitting happily with a ball of yarn — success & celebration
  ball: (
    <>
      {/* head */}
      <circle cx="124" cy="48" r="21" {...STROKE} />
      {/* pointy ears */}
      <path d="M110 34 L 104 16 L 122 30" {...STROKE} strokeWidth={5} />
      <path d="M138 34 L 144 16 L 126 30" {...STROKE} strokeWidth={5} />
      {/* eyes + happy mouth */}
      <circle cx="117" cy="46" r="3" fill="currentColor" stroke="none" />
      <circle cx="131" cy="46" r="3" fill="currentColor" stroke="none" />
      <path d="M120 54 q4 4 8 0" {...STROKE} strokeWidth={3.5} />
      {/* whiskers */}
      <path d="M118 52 L 100 50" {...STROKE} strokeWidth={3} />
      <path d="M118 56 L 102 60" {...STROKE} strokeWidth={3} />
      <path d="M130 52 L 148 50" {...STROKE} strokeWidth={3} />
      <path d="M130 56 L 146 60" {...STROKE} strokeWidth={3} />
      {/* sitting body */}
      <path d="M108 66 C 92 84, 88 108, 92 130" {...STROKE} />
      <path d="M140 66 C 152 84, 154 108, 150 130" {...STROKE} />
      {/* front legs */}
      <path d="M114 100 L 114 130" {...STROKE} />
      <path d="M132 100 L 132 130" {...STROKE} />
      {/* ground */}
      <path d="M84 132 h80" {...STROKE} strokeWidth={4} />
      {/* upright curling tail */}
      <path d="M150 120 C 168 116, 172 96, 160 84" {...STROKE} />
      <g className="text-brand-500">
        {/* ball of yarn + a loose thread */}
        <circle cx="48" cy="116" r="15" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M38 108 q10 8 20 0" {...ACCENT_STROKE} strokeWidth={3} />
        <path d="M40 122 q8 -6 18 -2" {...ACCENT_STROKE} strokeWidth={3} />
        <path d="M48 101 v30" {...ACCENT_STROKE} strokeWidth={3} />
        <path d="M63 116 q12 0 16 12" {...ACCENT_STROKE} strokeWidth={3.5} />
      </g>
    </>
  ),

  // Nose to the ground following a scent — search / no results
  sniffing: (
    <>
      {/* ground */}
      <path d="M24 134 h152" {...STROKE} strokeWidth={4} />
      {/* arched back + belly */}
      <path d="M96 108 C 100 84, 140 82, 152 106" {...STROKE} />
      <path d="M92 114 C 110 126, 138 126, 150 114" {...STROKE} />
      {/* legs */}
      <path d="M102 122 L 102 134" {...STROKE} />
      <path d="M140 120 L 140 134" {...STROKE} />
      {/* head lowered to the trail */}
      <circle cx="74" cy="112" r="16" {...STROKE} />
      {/* pointy ears */}
      <path d="M62 100 L 56 86 L 72 96" {...STROKE} strokeWidth={5} />
      <path d="M86 100 L 92 86 L 76 96" {...STROKE} strokeWidth={5} />
      {/* nose + whiskers */}
      <circle cx="60" cy="116" r="3" fill="currentColor" stroke="none" />
      <path d="M58 114 L 42 111" {...STROKE} strokeWidth={3} />
      <path d="M58 118 L 44 122" {...STROKE} strokeWidth={3} />
      {/* upright tail */}
      <path d="M150 100 C 164 92, 166 74, 156 66" {...STROKE} />
      <g className="text-brand-500">
        {/* scent squiggles leading away */}
        <path d="M42 126 q6 -6 0 -12 q-6 -6 0 -12" {...ACCENT_STROKE} />
        <path d="M26 130 q6 -6 0 -12 q-6 -6 0 -12" {...ACCENT_STROKE} />
        <circle cx="34" cy="90" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  // Head thrown back mid-meow — alerts
  howling: (
    <>
      {/* seated body */}
      <path d="M110 62 C 92 78, 86 104, 90 130" {...STROKE} />
      <path d="M134 50 C 150 74, 156 102, 152 130" {...STROKE} />
      {/* front legs */}
      <path d="M112 100 L 110 130" {...STROKE} />
      <path d="M130 100 L 130 130" {...STROKE} />
      {/* ground */}
      <path d="M80 132 h84" {...STROKE} strokeWidth={4} />
      {/* head tilted skyward */}
      <circle cx="122" cy="46" r="18" {...STROKE} />
      {/* pointy ears */}
      <path d="M110 32 L 106 15 L 122 28" {...STROKE} strokeWidth={5} />
      <path d="M136 32 L 140 15 L 126 28" {...STROKE} strokeWidth={5} />
      {/* eyes shut + open meow */}
      <path d="M113 43 q4 3 8 0" {...STROKE} strokeWidth={3.5} />
      <path d="M126 43 q4 3 8 0" {...STROKE} strokeWidth={3.5} />
      <path d="M119 52 q4 6 8 0" {...STROKE} strokeWidth={3.5} />
      {/* whiskers */}
      <path d="M115 50 L 99 48" {...STROKE} strokeWidth={3} />
      <path d="M131 50 L 147 48" {...STROKE} strokeWidth={3} />
      {/* upright tail */}
      <path d="M150 118 C 164 114, 168 96, 158 86" {...STROKE} />
      <g className="text-brand-500">
        {/* meow arcs rippling out */}
        <path d="M150 30 q8 -8 6 -18" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M162 40 q14 -12 12 -30" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M172 52 q20 -16 18 -42" {...ACCENT_STROKE} strokeWidth={4} />
      </g>
    </>
  ),
};

export default function CatIllustration({ name, className = 'h-32 w-auto', title }: CatIllustrationProps) {
  const a11y = title
    ? ({ role: 'img', 'aria-label': title } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" className={className} {...a11y}>
      {title && <title>{title}</title>}
      {POSES[name]}
    </svg>
  );
}
