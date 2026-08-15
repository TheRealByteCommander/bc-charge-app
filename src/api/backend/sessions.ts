import type { ChargingSession, UserProfile } from '../../types';
import type { GamificationState } from '../../types/gamification';
import { BackendApiError, backendApi } from './client';
import {
  SessionAbandonEnvelopeSchema,
  SessionCompleteEnvelopeSchema,
  SessionEnvelopeSchema,
  SessionRequiredEnvelopeSchema,
  SessionsListEnvelopeSchema,
  toChargingSession,
  toUserProfile,
} from './schemas';

export async function fetchSessions(): Promise<ChargingSession[]> {
  const res = await backendApi('/api/sessions', { schema: SessionsListEnvelopeSchema });
  return res.sessions.map(toChargingSession);
}

/** Nur prüfen ob eine aktive Sitzung existiert (ohne CitrineOS-Sync, rate-limit-freundlich). */
export async function fetchActiveSessionOnly(): Promise<ChargingSession | null> {
  try {
    const res = await backendApi('/api/sessions/active', { schema: SessionEnvelopeSchema });
    return res.session ? toChargingSession(res.session) : null;
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
  const res = await backendApi('/api/sessions/active/sync', { schema: SessionEnvelopeSchema });
  return res.session ? toChargingSession(res.session) : null;
}

/** CitrineOS Remote-Stop + finaler Sync (serverseitig, go-e/OCPP 1.6 + 2.0.1). */
export async function stopRemoteActiveSession(): Promise<ChargingSession> {
  const res = await backendApi('/api/sessions/active/stop-remote', {
    method: 'POST',
    schema: SessionRequiredEnvelopeSchema,
  });
  return toChargingSession(res.session);
}

/** Hängende aktive Sitzung serverseitig abschließen (ohne erneuten Ladestart). */
export async function abandonActiveSession(fallback?: ChargingSession): Promise<ChargingSession> {
  try {
    const res = await backendApi('/api/sessions/active/abandon', {
      method: 'POST',
      schema: SessionAbandonEnvelopeSchema,
    });
    return toChargingSession(res.session);
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
  const res = await backendApi('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ session }),
    schema: SessionRequiredEnvelopeSchema,
  });
  return toChargingSession(res.session);
}

export async function updateSession(session: ChargingSession): Promise<ChargingSession> {
  const res = await backendApi(`/api/sessions/${session.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ session }),
    schema: SessionRequiredEnvelopeSchema,
  });
  return toChargingSession(res.session);
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
  const res = await backendApi(`/api/sessions/${session.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ session, gamification }),
    schema: SessionCompleteEnvelopeSchema,
  });
  const invoice = res.invoice
    ? {
        ...(res.invoice.invoiceNumber !== undefined
          ? { invoiceNumber: res.invoice.invoiceNumber }
          : {}),
        ...(res.invoice.emailSent !== undefined ? { emailSent: res.invoice.emailSent } : {}),
        ...(res.invoice.emailSkipped !== undefined
          ? { emailSkipped: res.invoice.emailSkipped }
          : {}),
        ...(res.invoice.error !== undefined ? { error: res.invoice.error } : {}),
      }
    : res.invoice ?? null;
  return {
    session: toChargingSession(res.session),
    user: toUserProfile(res.user),
    invoice,
  };
}

export async function replaceAllSessions(sessions: ChargingSession[]): Promise<ChargingSession[]> {
  const res = await backendApi('/api/sessions', {
    method: 'PUT',
    body: JSON.stringify({ sessions }),
    schema: SessionsListEnvelopeSchema,
  });
  return res.sessions.map(toChargingSession);
}
