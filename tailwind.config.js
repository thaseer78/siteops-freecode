/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070B14',
          900: '#0B1220',
          800: '#111A2C',
          700: '#1B2740',
          600: '#2A3A57',
          500: '#44597A',
        },
        mint: {
          50: '#ECFDF7',
          100: '#D1FAEC',
          200: '#A7F3D9',
          300: '#6EE7BF',
          400: '#34D3A4',
          500: '#15B98D',
          600: '#0E9673',
          700: '#0C785E',
        },
        sky: { 400: '#5B8CFF', 500: '#3F6DF0', 600: '#2E55C8' },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Satoshi"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(9,16,30,0.06), 0 8px 24px -12px rgba(9,16,30,0.16)',
        lift: '0 2px 4px rgba(9,16,30,0.06), 0 20px 40px -20px rgba(9,16,30,0.35)',
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: { rise: 'rise .5s cubic-bezier(.2,.7,.3,1) both', pulseSoft: 'pulseSoft 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
