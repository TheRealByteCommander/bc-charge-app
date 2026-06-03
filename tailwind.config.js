/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bc: {
          ink: '#06080c',
          surface: '#0f1419',
          elevated: '#171e26',
          border: '#243040',
          muted: '#8b9cb3',
          text: '#e8eef6',
          accent: '#2ee59d',
          'accent-dim': '#1ab87a',
          glow: '#5dffb8',
          warn: '#ffb347',
          danger: '#ff6b6b',
          blue: '#4dabf7',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(46, 229, 157, 0.25)',
        card: '0 8px 32px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'bc-gradient': 'linear-gradient(135deg, #0f1419 0%, #06080c 50%, #0a1a14 100%)',
        'accent-gradient': 'linear-gradient(135deg, #2ee59d 0%, #1ab87a 100%)',
        'hero-mesh':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(46,229,157,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(77,171,247,0.08), transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        charge: 'charge 2s ease-in-out infinite',
      },
      keyframes: {
        charge: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
