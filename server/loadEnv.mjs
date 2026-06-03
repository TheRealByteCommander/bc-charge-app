import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/** Lädt Projekt-.env für den Express-Stripe-Server (Node lädt sie nicht von selbst). */
export function loadProjectEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const candidates = [resolve(root, '.env'), resolve(process.cwd(), '.env')];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    const text = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      const current = process.env[key];
      if (current === undefined || current === '') {
        process.env[key] = value;
      }
    }
    return envPath;
  }

  return null;
}
