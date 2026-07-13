import { randomBytes } from 'crypto';

export function createAccessToken() {
  return randomBytes(24).toString('hex');
}

export function createAdhocIdToken(sessionId) {
  return `ADHOC-${sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
}

export function createAdhocSessionId() {
  return `adhoc_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`;
}
