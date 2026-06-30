/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bc: {
          ink: '#1a1a2e',
          surface: '#f8f9fc',
          elevated: '#ffffff',
          border: '#e2e8f0',
          muted: '#64748b',
          text: '#1e293b',
          accent: '#10b981',
          'accent-dim': '#059669',
          glow: '#34d399',
          warn: '#f59e0b',
          danger: '#ef4444',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 4px 20px rgba(16, 185, 129, 0.2)',
        card: '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'bc-gradient': 'linear-gradient(180deg, #f8f9fc 0%, #f1f5f9 100%)',
        'accent-gradient': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'hero-mesh':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(59,130,246,0.05), transparent)',
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
