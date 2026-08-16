import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy':
        'camera=(self), geolocation=(self), microphone=(), payment=(self), usb=(), interest-cohort=()',
      'Content-Security-Policy':
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.stripe.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:* https://api.stripe.com https://*.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; worker-src 'self' blob:; manifest-src 'self'",
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/citrineos-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/citrineos-api/, ''),
      },
      '/citrineos-hasura': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/citrineos-hasura/, ''),
      },
      '/api': {
        target: 'http://localhost:4242',
        changeOrigin: true,
      },
    },
  },
});
