import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const PBKDF2_ITERATIONS = 210_000;

function legacyHashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  return `bc_${h.toString(16)}`;
}

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pw, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `pbkdf2_${salt.toString('base64')}_${hash.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  if (stored.startsWith('bc_')) {
    return legacyHashPassword(pw) === stored;
  }
  if (!stored.startsWith('pbkdf2_')) return false;
  const [, saltB64, hashB64] = stored.split('_');
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = pbkdf2Sync(pw, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function upgradePasswordHashIfLegacy(pw, stored) {
  if (stored.startsWith('pbkdf2_')) return stored;
  if (stored.startsWith('bc_') && legacyHashPassword(pw) === stored) {
    return hashPassword(pw);
  }
  return stored;
}
