import type { ReactNode } from 'react';

export type DogIllustrationName = 'sleeping' | 'digging' | 'ball' | 'sniffing' | 'howling';

interface DogIllustrationProps {
  name: DogIllustrationName;
  className?: string;
  title?: string;
}

/*
 * Hand-drawn-style line-art dogs for empty/error/success/search/alert
 * states. The dog renders in `currentColor` (callers pass a muted gray),
 * while each pose carries one brand-tinted accent group (ball, dirt,
 * scent, Zzz, sound arcs) so every state gets a spark of orange.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ACCENT_STROKE = { ...STROKE, strokeWidth: 5 } as const;

const POSES: Record<DogIllustrationName, ReactNode> = {
  // Curled up asleep, Zzz drifting off — "nothing here yet"
  sleeping: (
    <>
      {/* body mound */}
      <path d="M42 118 C 40 92, 66 76, 100 76 C 138 76, 162 92, 160 112 C 159 122, 150 126, 138 126 L 56 126 C 46 126, 43 123, 42 118 Z" {...STROKE} />
      {/* tail curled against the rump */}
      <circle cx="146" cy="112" r="10" {...STROKE} strokeWidth={5.5} />
      {/* head resting on paws */}
      <circle cx="70" cy="102" r="19" {...STROKE} />
      {/* solid floppy ear draped over the crown */}
      <path
        d="M56 90 C 48 72, 70 66, 76 80 C 78 86, 70 92, 56 90 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* closed eye */}
      <path d="M72 100 q5 4 10 0" {...STROKE} strokeWidth={4} />
      {/* nose */}
      <circle cx="53" cy="107" r="4.5" fill="currentColor" stroke="none" />
      {/* front paw peeking out */}
      <path d="M64 126 q10 -6 20 -2" {...STROKE} strokeWidth={5} />
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

  // Nose down at the hole, rump up, dirt flying — errors & 404 ("dug up nothing")
  digging: (
    <>
      {/* ground + the hole being dug */}
      <path d="M24 132 h152" {...STROKE} strokeWidth={4} />
      <path d="M34 132 q24 12 48 0" {...STROKE} strokeWidth={4} />
      {/* head down at the hole */}
      <circle cx="58" cy="114" r="15" {...STROKE} />
      {/* ear flopped forward */}
      <path d="M52 100 C 40 102, 38 114, 46 120" {...STROKE} />
      {/* nose */}
      <circle cx="45" cy="118" r="3" fill="currentColor" stroke="none" />
      {/* body sloping up to the rear */}
      <path d="M72 104 C 92 82, 124 78, 142 90" {...STROKE} />
      <path d="M78 122 C 100 112, 122 110, 138 114" {...STROKE} />
      <path d="M142 90 C 156 96, 158 112, 152 132" {...STROKE} />
      {/* hind leg + tail up */}
      <path d="M136 114 L 136 132" {...STROKE} />
      <path d="M148 88 C 158 80, 160 68, 154 60" {...STROKE} />
      <g className="text-brand-500">
        {/* dirt arcs + specks flying out of the hole */}
        <path d="M30 96 q-6 -10 -2 -18" {...ACCENT_STROKE} />
        <path d="M44 88 q-2 -10 6 -14" {...ACCENT_STROKE} />
        <circle cx="22" cy="66" r="3" fill="currentColor" stroke="none" />
        <circle cx="38" cy="60" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="14" cy="84" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  // Sitting happily with a ball — success & celebration
  ball: (
    <>
      {/* head */}
      <circle cx="122" cy="46" r="22" {...STROKE} />
      {/* floppy ears */}
      <path d="M104 34 C 92 38, 88 54, 96 60" {...STROKE} />
      <path d="M140 34 C 152 38, 156 54, 148 60" {...STROKE} />
      {/* eyes + nose + happy mouth */}
      <circle cx="115" cy="44" r="3" fill="currentColor" stroke="none" />
      <circle cx="129" cy="44" r="3" fill="currentColor" stroke="none" />
      <circle cx="122" cy="53" r="3.5" fill="currentColor" stroke="none" />
      <path d="M116 60 q6 5 12 0" {...STROKE} strokeWidth={4} />
      {/* sitting body */}
      <path d="M106 64 C 88 82, 82 106, 84 130" {...STROKE} />
      <path d="M138 64 C 152 82, 156 106, 154 130" {...STROKE} />
      {/* front legs */}
      <path d="M112 98 L 112 130" {...STROKE} />
      <path d="M132 98 L 132 130" {...STROKE} />
      {/* ground */}
      <path d="M76 132 h86" {...STROKE} strokeWidth={4} />
      {/* wagging tail */}
      <path d="M154 116 C 168 112, 174 100, 170 90" {...STROKE} />
      <g className="text-brand-500">
        {/* the ball, mid-bounce */}
        <circle cx="46" cy="116" r="14" fill="currentColor" stroke="none" />
        <path d="M46 88 q-2 -10 4 -16" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M26 100 q-8 -4 -10 -12" {...ACCENT_STROKE} strokeWidth={4} />
      </g>
    </>
  ),

  // Nose to the ground following a scent — search / no results
  sniffing: (
    <>
      {/* ground */}
      <path d="M24 134 h152" {...STROKE} strokeWidth={4} />
      {/* body */}
      <ellipse cx="124" cy="90" rx="42" ry="24" transform="rotate(-8 124 90)" {...STROKE} />
      {/* legs */}
      <path d="M102 134 L 104 112" {...STROKE} />
      <path d="M120 134 L 120 113" {...STROKE} />
      <path d="M140 134 L 140 112" {...STROKE} />
      <path d="M156 132 L 152 108" {...STROKE} />
      {/* head lowered to the trail */}
      <circle cx="72" cy="112" r="16" {...STROKE} />
      {/* floppy ear swung forward */}
      <path d="M66 98 C 54 100, 52 112, 60 120" {...STROKE} />
      {/* nose on the ground */}
      <circle cx="58" cy="118" r="3" fill="currentColor" stroke="none" />
      {/* alert tail */}
      <path d="M162 74 C 172 66, 174 54, 168 46" {...STROKE} />
      <g className="text-brand-500">
        {/* scent squiggles leading away */}
        <path d="M42 126 q6 -6 0 -12 q-6 -6 0 -12" {...ACCENT_STROKE} />
        <path d="M26 130 q6 -6 0 -12 q-6 -6 0 -12" {...ACCENT_STROKE} />
        <circle cx="34" cy="90" r="2.5" fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  // Head thrown back mid-howl — alerts
  howling: (
    <>
      {/* head tilted skyward with open muzzle */}
      <path d="M112 60 C 106 46, 112 32, 124 26 L 138 40" {...STROKE} />
      <path d="M124 26 L 134 14" {...STROKE} strokeWidth={5} />
      {/* ear swept back */}
      <path d="M118 58 C 106 58, 100 50, 102 40" {...STROKE} />
      {/* eye (blissfully shut) */}
      <path d="M118 42 q5 3 9 -1" {...STROKE} strokeWidth={4} />
      {/* nose tip */}
      <circle cx="135" cy="16" r="3.5" fill="currentColor" stroke="none" />
      {/* seated body */}
      <path d="M112 60 C 92 76, 84 102, 86 130" {...STROKE} />
      <path d="M136 44 C 150 68, 156 100, 152 130" {...STROKE} />
      {/* front legs */}
      <path d="M112 100 L 110 130" {...STROKE} />
      <path d="M130 100 L 130 130" {...STROKE} />
      {/* ground */}
      <path d="M78 132 h84" {...STROKE} strokeWidth={4} />
      {/* tail */}
      <path d="M152 118 C 166 114, 172 102, 168 92" {...STROKE} />
      <g className="text-brand-500">
        {/* sound arcs rippling out */}
        <path d="M152 28 q8 -8 6 -18" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M164 40 q14 -12 12 -30" {...ACCENT_STROKE} strokeWidth={4} />
        <path d="M174 54 q20 -16 18 -42" {...ACCENT_STROKE} strokeWidth={4} />
      </g>
    </>
  ),
};

export default function DogIllustration({ name, className = 'h-32 w-auto', title }: DogIllustrationProps) {
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
