import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), geolocation=(self), payment=(self)',
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
