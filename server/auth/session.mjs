import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'bc_session';
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

function getJwtSecret() {
  const secret = process.env.BC_JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BC_JWT_SECRET fehlt oder ist zu kurz (min. 32 Zeichen).');
  }
  return 'bc_dev_jwt_secret_change_in_production_32';
}

const secretKey = () => new TextEncoder().encode(getJwtSecret());

export async function createSessionToken(userId) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, secretKey());
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Ungültiges Token');
  }
  return payload.sub;
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.BC_COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SEC * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, path: '/' });
}
