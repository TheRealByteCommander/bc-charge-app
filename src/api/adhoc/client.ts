import type { ZodType } from 'zod';
import { apiConfig } from '../../config/api';
import { isPlainObject, safeParseJson } from '../../utils/safeJson';
import {
  ApiParseError,
  errorMessageFromPayload,
  OkEnvelopeSchema,
  parseApiData,
  readResponseJson,
} from '../parse';
import {
  AdhocLocalSessionSchema,
  AdhocPreparePaymentSchema,
  AdhocQuoteSchema,
  AdhocSessionEnvelopeSchema,
  type AdhocLocalSession,
} from './schemas';

export class AdhocApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AdhocApiError';
  }
}

type AdhocApiOptions = RequestInit & {
  schema?: ZodType;
  allowNonObject?: boolean;
};

async function adhocApi<T>(path: string, options: AdhocApiOptions = {}): Promise<T> {
  const { schema, allowNonObject, ...init } = options;
  const url = `${apiConfig.baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  let raw: unknown;
  try {
    raw = await readResponseJson(res);
  } catch (e) {
    if (!res.ok) {
      throw new AdhocApiError(`Ad-Hoc API ${res.status}`, res.status);
    }
    throw e instanceof ApiParseError
      ? new AdhocApiError(e.message, res.status)
      : new AdhocApiError(`Invalid JSON (HTTP ${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new AdhocApiError(
      errorMessageFromPayload(raw, `Ad-Hoc API ${res.status}`),
      res.status
    );
  }

  try {
    return parseApiData<T>(raw, schema as ZodType<T> | undefined, `adhoc ${path}`, {
      allowNonObject,
    });
  } catch (e) {
    if (e instanceof ApiParseError) {
      throw new AdhocApiError(e.message, res.status);
    }
    throw e;
  }
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
    return await adhocApi<{ ok: boolean }>('/api/adhoc/health', { schema: OkEnvelopeSchema });
  } catch {
    return { ok: false };
  }
}

export async function fetchAdhocQuote(stationId: string, connectorId: string): Promise<AdhocQuote> {
  return adhocApi('/api/adhoc/quote', {
    method: 'POST',
    body: JSON.stringify({ stationId, connectorId }),
    schema: AdhocQuoteSchema,
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
    schema: AdhocPreparePaymentSchema,
  });
}

export async function startAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi('/api/adhoc/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId, accessToken }),
    schema: AdhocSessionEnvelopeSchema,
  });
}

export async function pollAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi(
    `/api/adhoc/session/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(accessToken)}`,
    {
      headers: { 'X-Adhoc-Token': accessToken },
      schema: AdhocSessionEnvelopeSchema,
    }
  );
}

export async function stopAdhocSession(
  sessionId: string,
  accessToken: string
): Promise<{ session: AdhocSession }> {
  return adhocApi('/api/adhoc/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId, accessToken }),
    schema: AdhocSessionEnvelopeSchema,
  });
}

const STORAGE_KEY = 'bc_adhoc_session';

/** True when both local ad-hoc resume envelopes hold the same id + capability token. */
export function adhocLocalSessionEqual(
  a: AdhocLocalSession | null | undefined,
  b: AdhocLocalSession | null | undefined
): boolean {
  if (a == null || b == null) return a == null && b == null;
  return a.sessionId === b.sessionId && a.accessToken === b.accessToken;
}

export function parseAdhocSessionLocal(raw: string | null | undefined): AdhocLocalSession | null {
  if (raw == null || raw === '') return null;
  const parsed = safeParseJson<unknown>(raw, null);
  if (!isPlainObject(parsed)) return null;
  const result = AdhocLocalSessionSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function saveAdhocSessionLocal(sessionId: string, accessToken: string): void {
  const nextResult = AdhocLocalSessionSchema.safeParse({ sessionId, accessToken });
  if (!nextResult.success) return;
  const next = nextResult.data;
  // Guest poll / resume paths: skip sessionStorage rewrite when token envelope unchanged.
  if (adhocLocalSessionEqual(loadAdhocSessionLocal(), next)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function loadAdhocSessionLocal(): AdhocLocalSession | null {
  try {
    return parseAdhocSessionLocal(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearAdhocSessionLocal(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
