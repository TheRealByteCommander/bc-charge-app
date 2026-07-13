import type { ChargingSession, UserProfile } from '../../types';
import type { GamificationState } from '../../types/gamification';
import { BackendApiError, backendApi } from './client';

export async function fetchSessions(): Promise<ChargingSession[]> {
  const res = await backendApi<{ sessions: ChargingSession[] }>('/api/sessions');
  return res.sessions;
}

/** Nur prüfen ob eine aktive Sitzung existiert (ohne CitrineOS-Sync, rate-limit-freundlich). */
export async function fetchActiveSessionOnly(): Promise<ChargingSession | null> {
  try {
    const res = await backendApi<{ session: ChargingSession | null }>('/api/sessions/active');
    return res.session;
  } catch (e) {
    // Endpoint auf älterem Server noch nicht vorhanden
    if (e instanceof BackendApiError && e.status === 404) {
      const sessions = await fetchSessions();
      return sessions.find((s) => s.status === 'active') ?? null;
    }
    throw e;
  }
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

/** Hängende aktive Sitzung serverseitig abschließen (ohne erneuten Ladestart). */
export async function abandonActiveSession(fallback?: ChargingSession): Promise<ChargingSession> {
  try {
    const res = await backendApi<{ session: ChargingSession; abandoned?: boolean }>(
      '/api/sessions/active/abandon',
      { method: 'POST' }
    );
    return res.session;
  } catch (e) {
    // API noch nicht neu gestartet / Route fehlt → per PATCH abschließen (ältere Server-Version)
    if (e instanceof BackendApiError && e.status === 404 && fallback?.id) {
      const completed: ChargingSession = {
        ...fallback,
        status: 'completed',
        endedAt: new Date().toISOString(),
        paymentStatus:
          fallback.costEur >= 0.5 ? fallback.paymentStatus ?? 'skipped' : 'skipped',
      };
      return updateSession(completed);
    }
    throw e;
  }
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
