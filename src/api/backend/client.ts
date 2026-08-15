import type { z, ZodType, ZodTypeAny } from 'zod';
import { apiConfig } from '../../config/api';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  ApiParseError,
  errorMessageFromPayload,
  OkEnvelopeSchema,
  parseApiData,
  readResponseJson,
} from '../parse';

export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

type BackendRequestInit = RequestInit & {
  /** Allow non-object JSON when no schema (rare). */
  allowNonObject?: boolean;
};

/** Schema-backed call — return type is Zod output (post-transform). */
export async function backendApi<S extends ZodTypeAny>(
  path: string,
  options: BackendRequestInit & { schema: S },
  timeoutMs?: number
): Promise<z.output<S>>;

/** Untyped / legacy generic call (prefer schema overload). */
export async function backendApi<T = unknown>(
  path: string,
  options?: BackendRequestInit & { schema?: ZodType<T> },
  timeoutMs?: number
): Promise<T>;

export async function backendApi(
  path: string,
  options: BackendRequestInit & { schema?: ZodTypeAny } = {},
  timeoutMs = 12_000
): Promise<unknown> {
  const { schema, allowNonObject, ...init } = options;
  const url = `${apiConfig.baseUrl}${path}`;
  const res = await fetchWithTimeout(
    url,
    {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    },
    timeoutMs
  );

  let raw: unknown;
  try {
    raw = await readResponseJson(res);
  } catch (e) {
    if (!res.ok) {
      throw new BackendApiError(`Anfrage fehlgeschlagen (HTTP ${res.status})`, res.status);
    }
    throw e instanceof ApiParseError
      ? new BackendApiError(e.message, res.status)
      : new BackendApiError(`Invalid JSON (HTTP ${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new BackendApiError(
      errorMessageFromPayload(raw, `Anfrage fehlgeschlagen (HTTP ${res.status})`),
      res.status
    );
  }

  try {
    return parseApiData(raw, schema, `backend ${path}`, {
      allowNonObject,
    });
  } catch (e) {
    if (e instanceof ApiParseError) {
      throw new BackendApiError(e.message, res.status);
    }
    throw e;
  }
}

export async function backendHealth(): Promise<boolean> {
  try {
    const r = await backendApi('/api/health', { schema: OkEnvelopeSchema });
    return r.ok;
  } catch {
    return false;
  }
}
