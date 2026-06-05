import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
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
  } = {}
): Promise<T> {
  const { method = 'GET', query, body } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CITRINEOS_FETCH_MS);
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
      const proxyPayload = (await res.json()) as { ok?: boolean; data?: T; error?: string };
      if (!res.ok || proxyPayload.ok === false) {
        throw new CitrineosApiError(proxyPayload.error ?? `CitrineOS Proxy ${res.status}`, res.status, proxyPayload);
      }
      return proxyPayload.data as T;
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

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String((parsed as { message: string }).message)
        : `CitrineOS API ${res.status}`;
    throw new CitrineosApiError(msg, res.status, parsed);
  }

  return parsed as T;
}

export async function citrineosHealth(): Promise<boolean> {
  try {
    if (isBackendMode()) {
      const r = await fetch(`${apiConfig.baseUrl}/api/citrineos/health`, { credentials: 'include' });
      const json = (await r.json()) as { ok?: boolean };
      return Boolean(json.ok);
    }
    await citrineosFetch<{ status?: string }>(citrineosPaths.health);
    return true;
  } catch {
    return false;
  }
}
