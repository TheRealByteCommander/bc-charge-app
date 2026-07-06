import type { ChargingSession } from '../types';

export function formatConcurrentSessionError(session: Pick<ChargingSession, 'stationName'>): string {
  const name = session.stationName?.trim() || 'einer anderen Station';
  return `Sie laden bereits an „${name}“. Bitte beenden Sie dort zuerst den Ladevorgang, bevor Sie eine weitere Säule nutzen.`;
}

export function findActiveSession(sessions: ChargingSession[]): ChargingSession | undefined {
  return sessions.find((s) => s.status === 'active');
}

export function isSessionBlockingStart(
  active: ChargingSession | null | undefined,
  stationId: string
): boolean {
  return Boolean(active && active.stationId !== stationId);
}
