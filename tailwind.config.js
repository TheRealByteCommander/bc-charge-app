/** @type {import('tailwindcss').Config} */
/** Brand palette extracted from official BC Charge logo (cyan bolt + lime plug/word). */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bc: {
          ink: '#0b1620',
          surface: '#12202c',
          elevated: '#1a2c3a',
          border: '#2e4658',
          muted: '#8fa3b5',
          text: '#e8f1f6',
          // Logo lime green (CHARGE / plug)
          accent: '#a0e040',
          'accent-dim': '#7fc428',
          'accent-soft': 'rgba(160, 224, 64, 0.12)',
          glow: '#b8f05c',
          // Logo cyan-blue (BC / bolt)
          blue: '#00c8d8',
          'blue-dim': '#00a8b8',
          'blue-soft': 'rgba(0, 200, 216, 0.12)',
          warn: '#f59e0b',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 4px 20px rgba(160, 224, 64, 0.22)',
        'glow-blue': '0 4px 20px rgba(0, 200, 216, 0.22)',
        card: '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'bc-gradient': 'linear-gradient(180deg, #0b1620 0%, #12202c 100%)',
        'accent-gradient': 'linear-gradient(135deg, #a0e040 0%, #7fc428 100%)',
        'brand-gradient': 'linear-gradient(135deg, #00c8d8 0%, #a0e040 100%)',
        'hero-mesh':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,200,216,0.14), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(160,224,64,0.10), transparent)',
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
