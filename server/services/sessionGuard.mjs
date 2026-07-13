import { findActiveSessionForUser } from '../db.mjs';

export function formatConcurrentSessionError(existing) {
  const name = existing?.stationName ?? 'einer anderen Station';
  return `Sie laden bereits an „${name}“. Bitte beenden Sie dort zuerst den Ladevorgang, bevor Sie eine weitere Säule nutzen.`;
}

export async function assertCanActivateSession(userId, session) {
  if (session?.status !== 'active') return;

  const existing = await findActiveSessionForUser(userId, session.id);
  if (existing) {
    throw Object.assign(new Error(formatConcurrentSessionError(existing)), {
      status: 409,
      code: 'CONCURRENT_SESSION',
      activeSession: existing,
    });
  }
}

export function assertSingleActiveInPayload(sessions) {
  if (!Array.isArray(sessions)) return;
  const active = sessions.filter((s) => s?.status === 'active');
  if (active.length > 1) {
    throw Object.assign(
      new Error('Es darf höchstens eine aktive Ladesitzung pro Konto geben.'),
      { status: 400, code: 'MULTIPLE_ACTIVE_SESSIONS' }
    );
  }
}
