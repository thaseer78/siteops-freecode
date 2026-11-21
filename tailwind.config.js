/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Neutral "ink" scale is CSS-variable driven so the same markup works on
           both the crisp light surfaces and the obsidian customer surfaces.
           Light scope: charcoal headings / slate body.
           Dark scope ([data-theme="dark"]): white headings / zinc body. */
        ink: {
          950: 'rgb(var(--ink-950) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
        },
        /* Electric violet / lavender accent system. */
        primary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C084FC',
          400: '#C084FC',
          500: '#A855F7',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        /* Surfaces + hairlines, theme-driven via CSS variables so the same
           component markup works on light and obsidian surfaces. */
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        line: 'var(--line)',
        page: 'var(--page)',
        obsidian: '#0D0C11',
        plum: { 900: '#0F0E13', 800: '#16151D', 700: '#1E1533', 600: '#262432' },
        alabaster: '#FAFAFC',
        hairline: '#EAE8F2',
        brand: '#7C3AED',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(17, 12, 34, 0.04)',
        lift: '0 2px 6px rgba(17, 12, 34, 0.05), 0 24px 48px -24px rgba(17, 12, 34, 0.28)',
        glow: '0 18px 50px -20px rgba(124, 58, 237, 0.55)',
      },
      borderRadius: { '4xl': '1.75rem' },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: { rise: 'rise .5s cubic-bezier(.2,.7,.3,1) both', pulseSoft: 'pulseSoft 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
