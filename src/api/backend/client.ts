import type { ZodType } from 'zod';
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

export type BackendApiOptions = RequestInit & {
  /** Optional Zod schema — preferred over bare generic cast. */
  schema?: ZodType;
  /** Allow non-object JSON when no schema (rare). */
  allowNonObject?: boolean;
};

export async function backendApi<T>(
  path: string,
  options: BackendApiOptions = {},
  timeoutMs = 12_000
): Promise<T> {
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
    return parseApiData<T>(raw, schema as ZodType<T> | undefined, `backend ${path}`, {
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
    const r = await backendApi<{ ok: boolean }>('/api/health', { schema: OkEnvelopeSchema });
    return r.ok;
  } catch {
    return false;
  }
}
