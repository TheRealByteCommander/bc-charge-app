/**
 * Server-side client for the Load-Management service (ports 3001 health / 3003 API).
 * Admin calls use LM_API_KEY (Bearer or x-lm-api-key).
 */

import logger from '../utils/logger.mjs';
import { safeParseResponseJsonAllowText } from '../utils/safeJson.mjs';

const DEFAULT_API_BASE = 'http://127.0.0.1:3003';
const DEFAULT_HEALTH_BASE = 'http://127.0.0.1:3001';
const DEFAULT_TIMEOUT_MS = 8_000;

function envFlagTrue(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getLoadManagementApiBase(
  env = process.env
) {
  return (
    env.LOAD_MANAGEMENT_API_URL ||
    env.LM_API_URL ||
    DEFAULT_API_BASE
  ).replace(/\/$/, '');
}

export function getLoadManagementHealthBase(
  env = process.env
) {
  return (
    env.LOAD_MANAGEMENT_HEALTH_URL ||
    env.LM_HEALTH_URL ||
    DEFAULT_HEALTH_BASE
  ).replace(/\/$/, '');
}

export function getLoadManagementApiKey(env = process.env) {
  const key = (env.LM_API_KEY || env.LOAD_MANAGEMENT_API_KEY || '').trim();
  return key.length > 0 ? key : undefined;
}

export function isLoadManagementEnabled(env = process.env) {
  if (envFlagTrue(env.LOAD_MANAGEMENT_DISABLED) || envFlagTrue(env.LM_DISABLED)) {
    return false;
  }
  // Enabled when URL is set or LM_ENABLED=1; default on in non-prod when key present
  if (envFlagTrue(env.LOAD_MANAGEMENT_ENABLED) || envFlagTrue(env.LM_ENABLED)) {
    return true;
  }
  if (env.LOAD_MANAGEMENT_API_URL || env.LM_API_URL) return true;
  // Dev convenience: if key is configured, assume local LM is intended
  return Boolean(getLoadManagementApiKey(env));
}

/**
 * @param {string} path path starting with /
 * @param {{ method?: string, body?: unknown, query?: Record<string, string|number|boolean|undefined>, timeoutMs?: number, auth?: boolean, base?: 'api'|'health' }} [opts]
 */
export async function loadManagementFetch(path, opts = {}) {
  const {
    method = 'GET',
    body,
    query,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
    base = 'api',
  } = opts;

  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    return {
      ok: false,
      status: 400,
      error: 'path must start with /',
      data: null,
    };
  }

  const root =
    base === 'health' ? getLoadManagementHealthBase() : getLoadManagementApiBase();
  const url = new URL(path, `${root}/`);
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }

  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const key = getLoadManagementApiKey();
    if (key) {
      headers.Authorization = `Bearer ${key}`;
      headers['x-lm-api-key'] = key;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await r.text();
    const data = text ? safeParseResponseJsonAllowText(text, null) : null;
    return {
      ok: r.ok,
      status: r.status,
      data,
      error: r.ok
        ? null
        : typeof data === 'object' && data && 'message' in data
          ? String(/** @type {any} */ (data).message)
          : `LM HTTP ${r.status}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Load-Management unreachable';
    logger.warn('[LM] fetch failed', { path, method, message });
    return {
      ok: false,
      status: 502,
      data: null,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getLoadManagementHealth() {
  const detailed = await loadManagementFetch('/health/detailed', {
    auth: false,
    base: 'health',
    timeoutMs: 4_000,
  });
  if (detailed.ok) {
    return { ok: true, configured: isLoadManagementEnabled(), detailed: detailed.data };
  }
  const basic = await loadManagementFetch('/health', {
    auth: false,
    base: 'health',
    timeoutMs: 4_000,
  });
  return {
    ok: basic.ok,
    configured: isLoadManagementEnabled(),
    detailed: basic.data,
    error: basic.ok ? null : basic.error,
  };
}

export default {
  getLoadManagementApiBase,
  getLoadManagementHealthBase,
  getLoadManagementApiKey,
  isLoadManagementEnabled,
  loadManagementFetch,
  getLoadManagementHealth,
};
