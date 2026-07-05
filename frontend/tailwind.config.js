import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#fef7ee',
          100: '#fdedd3',
          200: '#fad7a5',
          300: '#f6bb6d',
          400: '#f19532',
          500: '#ee7a10',
          600: '#df6009',
          700: '#b9480a',
          800: '#933910',
          900: '#773110',
        },
        // Semantic tones — aliases of full Tailwind palettes so every shade
        // exists (danger-500 === red-500). New code uses these names; raw
        // red/amber/emerald/sky classes migrate only when a file is touched.
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.red,
        info: colors.sky,
      },
      fontSize: {
        // 11px/14px — replaces arbitrary text-[10px]/text-[11px] micro sizes
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      maxWidth: {
        app: '420px',
      },
      boxShadow: {
        'soft-sm': '0 1px 2px rgba(17, 24, 39, 0.04), 0 1px 3px rgba(17, 24, 39, 0.04)',
        soft: '0 4px 12px -2px rgba(17, 24, 39, 0.06), 0 2px 4px -1px rgba(17, 24, 39, 0.04)',
        'soft-lg': '0 20px 40px -12px rgba(17, 24, 39, 0.12), 0 6px 12px -4px rgba(17, 24, 39, 0.06)',
        'brand-glow': '0 8px 24px -8px rgba(238, 122, 16, 0.45)',
        'inset-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
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
      },
      transitionTimingFunction: {
        'soft-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
