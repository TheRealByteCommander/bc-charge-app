import type { ZodType } from 'zod';
import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  ApiParseError,
  errorMessageFromPayload,
  OkEnvelopeSchema,
  parseApiData,
  parseWithSchema,
  ProxyEnvelopeSchema,
  readResponseJson,
} from '../parse';
import { citrineosPaths } from './paths';

export class CitrineosApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'CitrineosApiError';
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const base = citrineosConfig.apiUrl;
  const url = path.startsWith('http') ? new URL(path) : new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

const CITRINEOS_FETCH_MS = 4000;

export async function citrineosFetch<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    timeoutMs?: number;
    /** Optional Zod schema applied after HTTP/proxy success. */
    schema?: ZodType<T>;
    allowNonObject?: boolean;
  } = {}
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    timeoutMs = CITRINEOS_FETCH_MS,
    schema,
    allowNonObject = true,
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    if (isBackendMode()) {
      res = await fetch(`${apiConfig.baseUrl}/api/citrineos/proxy`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ path, method, query, body }),
        signal: controller.signal,
      });
      let raw: unknown;
      try {
        raw = await readResponseJson(res);
      } catch (e) {
        throw new CitrineosApiError(
          e instanceof ApiParseError ? e.message : 'CitrineOS Proxy returned invalid JSON',
          res.status
        );
      }
      let proxyPayload: { ok?: boolean; data?: unknown; error?: string };
      try {
        proxyPayload = parseWithSchema(raw ?? {}, ProxyEnvelopeSchema, 'citrineos proxy');
      } catch (e) {
        throw new CitrineosApiError(
          e instanceof ApiParseError ? e.message : 'CitrineOS Proxy returned non-object payload',
          res.status,
          raw
        );
      }
      if (!res.ok || proxyPayload.ok === false) {
        throw new CitrineosApiError(
          proxyPayload.error ??
            errorMessageFromPayload(proxyPayload, `CitrineOS Proxy ${res.status}`),
          res.status,
          proxyPayload
        );
      }
      try {
        return parseApiData<T>(proxyPayload.data, schema, `citrineos proxy ${path}`, {
          allowNonObject,
        });
      } catch (e) {
        throw new CitrineosApiError(
          e instanceof ApiParseError ? e.message : 'CitrineOS proxy data parse failed',
          res.status,
          proxyPayload.data
        );
      }
    }

    res = await fetch(buildUrl(path, query), {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  let parsed: unknown = undefined;
  try {
    parsed = await readResponseJson(res);
  } catch (e) {
    if (!res.ok) {
      throw new CitrineosApiError(`CitrineOS API ${res.status}`, res.status);
    }
    throw new CitrineosApiError(
      e instanceof ApiParseError ? e.message : `Invalid JSON (HTTP ${res.status})`,
      res.status
    );
  }

  if (!res.ok) {
    throw new CitrineosApiError(
      errorMessageFromPayload(parsed, `CitrineOS API ${res.status}`),
      res.status,
      parsed
    );
  }

  try {
    return parseApiData<T>(parsed, schema, `citrineos ${path}`, { allowNonObject });
  } catch (e) {
    throw new CitrineosApiError(
      e instanceof ApiParseError ? e.message : 'CitrineOS response parse failed',
      res.status,
      parsed
    );
  }
}

export async function citrineosHealth(): Promise<boolean> {
  try {
    if (isBackendMode()) {
      const r = await fetchWithTimeout(
        `${apiConfig.baseUrl}/api/citrineos/health`,
        { credentials: 'include' },
        5000
      );
      const raw = await readResponseJson(r);
      if (!r.ok) return false;
      const json = parseWithSchema(raw ?? {}, OkEnvelopeSchema, 'citrineos health');
      return Boolean(json.ok);
    }
    await citrineosFetch(citrineosPaths.health, {
      schema: OkEnvelopeSchema.partial().passthrough(),
      allowNonObject: true,
    });
    return true;
  } catch {
    return false;
  }
}
