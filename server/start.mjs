import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectEnv } from './loadEnv.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loadedFrom = loadProjectEnv();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[bc-charge] STRIPE_SECRET_KEY fehlt – Stripe-API antwortet mit 503.');
  console.warn('[bc-charge] Projektordner:', root);
  console.warn('[bc-charge] .env vorhanden:', existsSync(resolve(root, '.env')) ? 'ja' : 'nein');
  console.warn('[bc-charge] geladen von:', loadedFrom ?? 'keine Datei');
  console.warn('[bc-charge] cwd:', process.cwd());
} else {
  const mode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test';
  console.log(`[bc-charge] Stripe konfiguriert (${mode})`);
}

await import('./index.mjs');
