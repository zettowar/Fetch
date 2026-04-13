/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
      },
      maxWidth: {
        app: '420px',
      },
    },
  },
  plugins: [],
};
