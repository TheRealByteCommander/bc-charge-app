/** Passwort-Hashing im Browser (Demo). Produktion: immer serverseitig (Argon2/bcrypt). */

const PBKDF2_ITERATIONS = 210_000;

function legacyHashPassword(pw: string): string {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  return `bc_${h.toString(16)}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2_${toBase64(salt)}_${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  if (stored.startsWith('bc_')) {
    return legacyHashPassword(pw) === stored;
  }
  if (!stored.startsWith('pbkdf2_')) return false;
  const [, saltB64, hashB64] = stored.split('_');
  if (!saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const expected = fromBase64(hashB64);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** Nach erfolgreichem Login alten schwachen Hash ersetzen. */
export async function upgradePasswordHashIfLegacy(pw: string, stored: string): Promise<string> {
  if (stored.startsWith('pbkdf2_')) return stored;
  if (stored.startsWith('bc_') && legacyHashPassword(pw) === stored) {
    return hashPassword(pw);
  }
  return stored;
}
