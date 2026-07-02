import { apiConfig } from '../../config/api';

export class AdhocApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AdhocApiError';
  }
}

async function adhocApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${apiConfig.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new AdhocApiError(data.error ?? `Ad-Hoc API ${res.status}`, res.status);
  }
  return data as T;
}

export interface AdhocQuote {
  stationId: string;
  stationName: string;
  address: string;
  connector: {
    id: string;
    type: string;
    powerKw: number;
    pricePerKwh: number;
    sessionFee: number;
    pricePerMin: number;
  };
  preAuthCents: number;
  preAuthEur: number;
  currency: string;
}

export interface AdhocSession {
  id: string;
  accessToken: string;
  stationId: string;
  stationName: string;
  address?: string;
  connectorId: string;
  connectorType: string;
  powerKw: number;
  pricePerKwh: number;
  sessionFee: number;
  status: 'payment_pending' | 'active' | 'completed';
  paymentIntentId?: string;
  preAuthCents: number;
  energyKwh: number;
  costEur: number;
  startedAt?: string | null;
  endedAt?: string;
  chargingState?: string | null;
  paymentStatus?: string;
  captureCents?: number;
}

export async function adhocHealth(): Promise<{ ok: boolean }> {
  try {
    return await adhocApi<{ ok: boolean }>('/api/adhoc/health');
  } catch {
    return { ok: false };
  }
}

export async function fetchAdhocQuote(stationId: string, connectorId: string): Promise<AdhocQuote> {
  return adhocApi('/api/adhoc/quote', {
    method: 'POST',
    body: JSON.stringify({ stationId, connectorId }),
  });
}

export async function prepareAdhocPayment(params: {
  stationId: string;
  connectorId: string;
  email?: string;
}): Promise<{ sessionId: string; accessToken: string; clientSecret: string; preAuthCents: number }> {
  return adhocApi('/api/adhoc/prepare-payment', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function startAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi('/api/adhoc/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId, accessToken }),
  });
}

export async function pollAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi(`/api/adhoc/session/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(accessToken)}`, {
    headers: { 'X-Adhoc-Token': accessToken },
  });
}

export async function stopAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi('/api/adhoc/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId, accessToken }),
  });
}

const STORAGE_KEY = 'bc_adhoc_session';

export function saveAdhocSessionLocal(sessionId: string, accessToken: string): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, accessToken }));
}

export function loadAdhocSessionLocal(): { sessionId: string; accessToken: string } | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { sessionId?: string; accessToken?: string };
    if (parsed.sessionId && parsed.accessToken) return { sessionId: parsed.sessionId, accessToken: parsed.accessToken };
  } catch {
    /* ignore */
  }
  return null;
}

export function clearAdhocSessionLocal(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
