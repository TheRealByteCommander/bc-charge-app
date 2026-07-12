import type { ChargingSession, UserProfile } from '../../types';
import type { GamificationState } from '../../types/gamification';
import { backendApi } from './client';

export async function fetchSessions(): Promise<ChargingSession[]> {
  const res = await backendApi<{ sessions: ChargingSession[] }>('/api/sessions');
  return res.sessions;
}

/** Aktive Session mit Live-Daten aus CitrineOS synchronisieren (serverseitig). */
export async function syncActiveSession(): Promise<ChargingSession | null> {
  const res = await backendApi<{ session: ChargingSession | null }>('/api/sessions/active/sync');
  return res.session;
}

/** CitrineOS Remote-Stop + finaler Sync (serverseitig, go-e/OCPP 1.6 + 2.0.1). */
export async function stopRemoteActiveSession(): Promise<ChargingSession> {
  const res = await backendApi<{ session: ChargingSession }>('/api/sessions/active/stop-remote', {
    method: 'POST',
  });
  return res.session;
}

export async function saveSession(session: ChargingSession): Promise<ChargingSession> {
  const res = await backendApi<{ session: ChargingSession }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ session }),
  });
  return res.session;
}

export async function updateSession(session: ChargingSession): Promise<ChargingSession> {
  const res = await backendApi<{ session: ChargingSession }>(`/api/sessions/${session.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ session }),
  });
  return res.session;
}

export interface SessionCompleteResult {
  session: ChargingSession;
  user: UserProfile;
  invoice?: {
    invoiceNumber?: string;
    emailSent?: boolean;
    emailSkipped?: boolean;
    error?: string;
  } | null;
}

export async function completeSessionRemote(
  session: ChargingSession,
  gamification?: GamificationState
): Promise<SessionCompleteResult> {
  return backendApi(`/api/sessions/${session.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ session, gamification }),
  });
}

export async function replaceAllSessions(sessions: ChargingSession[]): Promise<ChargingSession[]> {
  const res = await backendApi<{ sessions: ChargingSession[] }>('/api/sessions', {
    method: 'PUT',
    body: JSON.stringify({ sessions }),
  });
  return res.sessions;
}
