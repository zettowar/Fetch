/*
 * Fetchpawz brand palette (Brand Book, Edition 2).
 *   Ball Orange  #FF6A1F  play: primary buttons, the like, the mark
 *   Leash Navy   #1C1F45  ink: text, outlines, the toy shadow
 *   Crown Gold   #FFC233  earned: crowns, ranks, winners — never decoration
 *   Forever Pink #FF5C93  rescue: a pet who needs a home
 *   Off-Leash Green #22B07A  real world: parks, "I can help"
 *   Biscuit      #FFF2E3  paper: the page
 * Text on any colour fill is Leash Navy ("navy on color"); white on orange
 * fails contrast.
 */
const ORANGE = {
  50: '#FFF6EF',
  100: '#FFE4D1',
  200: '#FFC9A6',
  300: '#FFA26B',
  400: '#FF8445',
  500: '#FF6A1F',
  600: '#C94A0D',
  700: '#A83A0B',
  800: '#86300D',
  900: '#6B280E',
  950: '#3A1205',
};
// The ink scale: warm paper at the light end, Leash Navy and the night
// grounds at the dark end. Mid-tones are navy, not grey, so muted text
// still reads as the same pen.
const INK = {
  50: '#FFF8F0',
  100: '#F5EEE7',
  200: '#E4E1E7',
  300: '#C6C8DE',
  400: '#9D9FBF',
  500: '#686B90',
  600: '#5D6085',
  700: '#44476B',
  800: '#262A58',
  900: '#1B1E44',
  950: '#11132E',
};
const NAVY = {
  50: '#F4F4F9',
  100: '#E3E4F0',
  200: '#C6C8DE',
  300: '#A9ABCB',
  400: '#7D80A6',
  500: '#4B4F87',
  600: '#3A3D6E',
  700: '#2F3258',
  800: '#1C1F45',
  900: '#141634',
  950: '#0A0C22',
};
const GOLD = {
  50: '#FFFAEB',
  100: '#FFF0C7',
  200: '#FFE08A',
  300: '#FFD36B',
  400: '#FFCB4F',
  500: '#FFC233',
  600: '#E0A00F',
  700: '#A86F06',
  800: '#7C5208',
  900: '#5E3F0B',
  950: '#382304',
};
const PINK = {
  50: '#FFF3F7',
  100: '#FFE0EA',
  200: '#FFB9D0',
  300: '#FF8DB4',
  400: '#FF73A3',
  500: '#FF5C93',
  600: '#E23B74',
  700: '#C21E5C',
  800: '#9C1849',
  900: '#7E173E',
  950: '#4A0720',
};
const GREEN = {
  50: '#EEFBF5',
  100: '#D6F3E6',
  200: '#A6E3C9',
  300: '#6FCEA6',
  400: '#3FBE8C',
  500: '#22B07A',
  600: '#179165',
  700: '#127550',
  800: '#0F5D41',
  900: '#0C4C36',
  950: '#052A1E',
};
const DANGER = {
  50: '#FDF0F1',
  100: '#FDE2E4',
  200: '#F9C2C7',
  300: '#F2949C',
  400: '#E5606B',
  500: '#D0313D',
  600: '#B4232F',
  700: '#A11E2A',
  800: '#7F1A24',
  900: '#661820',
  950: '#3A0A0F',
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Figtree is the workhorse; Bagel Fat One is the fat one (headlines,
        // pet names, ranks — 24px and up); DM Mono is the tag (codes, hex).
        sans: [
          'Figtree',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: ['"Bagel Fat One"', 'Figtree', 'ui-rounded', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // ── Brand book, Edition 2 ───────────────────────────────────────
        // Every stock palette the app uses is re-pointed at the brand, so a
        // `text-gray-500` or `bg-red-50` written years ago lands on the new
        // system without touching the file. Names say what the colour is
        // for, not what it looks like (see the Color chapter).
        brand: ORANGE,
        orange: ORANGE,
        gray: INK,
        slate: INK,
        zinc: INK,
        neutral: INK,
        stone: INK,
        navy: { DEFAULT: '#1C1F45', ...NAVY },
        biscuit: { DEFAULT: '#FFF2E3', deep: '#F1D9BC' },
        night: { DEFAULT: '#11132E', surface: '#1B1E44', raised: '#262A58' },
        gold: GOLD,
        amber: GOLD,
        yellow: GOLD,
        pink: PINK,
        rose: PINK,
        fuchsia: PINK,
        green: GREEN,
        emerald: GREEN,
        teal: GREEN,
        lime: GREEN,
        red: DANGER,
        // No blue or purple in the palette: informational and premium
        // surfaces are Leash Navy.
        blue: NAVY,
        sky: NAVY,
        cyan: NAVY,
        indigo: NAVY,
        violet: NAVY,
        purple: NAVY,
        // Semantic tones — new code uses these names.
        success: GREEN,
        warning: GOLD,
        danger: DANGER,
        info: NAVY,
      },
      borderRadius: {
        // Brand radius scale: 10 for inputs and tiles, 20 for panels,
        // 28 for cards and plates, pill for buttons and chips.
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      fontSize: {
        // 11px/14px — replaces arbitrary text-[10px]/text-[11px] micro sizes
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      maxWidth: {
        app: '420px',
      },
      boxShadow: {
        'soft-sm': '0 1px 2px rgba(28, 31, 69, 0.06)',
        soft: '0 6px 16px -8px rgba(28, 31, 69, 0.22)',
        'soft-lg': '0 20px 40px -16px rgba(17, 19, 46, 0.30)',
        'brand-glow': '0 8px 22px -8px rgba(255, 106, 31, 0.55)',
        'inset-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        // The toy shadow: a hard nudge, 3px right and 4px down. Only on things
        // you can touch or win. The ledge is what a pressable button sits on.
        toy: '3px 4px 0 0 rgb(var(--toy-shadow))',
        'toy-sm': '2px 3px 0 0 rgb(var(--toy-shadow))',
        ledge: '0 3px 0 0 rgb(var(--toy-shadow))',
        'ledge-sm': '0 2px 0 0 rgb(var(--toy-shadow))',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        heartbeat: {
          '0%, 45%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.2)' },
          '25%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.15)' },
        },
        'paw-step': {
          '0%, 60%, 100%': { opacity: '0.2', transform: 'scale(0.85)' },
          '20%, 40%': { opacity: '1', transform: 'scale(1)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(8deg)' },
        },
        wag: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-12deg)' },
          '60%': { transform: 'rotate(9deg)' },
          '80%': { transform: 'rotate(-3deg)' },
        },
        'tail-wag': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '18%': { transform: 'rotate(-16deg)' },
          '40%': { transform: 'rotate(11deg)' },
          '62%': { transform: 'rotate(-7deg)' },
          '82%': { transform: 'rotate(3deg)' },
        },
        'crown-drop': {
          '0%': { transform: 'translateY(-60px) rotate(-18deg)', opacity: '0' },
          '55%': { transform: 'translateY(4px) rotate(4deg) scaleY(0.86)', opacity: '1' },
          '75%': { transform: 'translateY(-4px) rotate(-2deg) scaleY(1.04)' },
          '100%': { transform: 'translateY(0) rotate(0) scaleY(1)' },
        },
        'float-up': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '40%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.25s ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 0.18s ease-out',
        heartbeat: 'heartbeat 1.6s ease-in-out infinite',
        'paw-step': 'paw-step 1.2s ease-in-out infinite',
        wiggle: 'wiggle 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'float-up': 'float-up 2.4s ease-in-out infinite',
        wag: 'wag 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'tail-wag': 'tail-wag 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        'crown-drop': 'crown-drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
      transitionTimingFunction: {
        'soft-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
