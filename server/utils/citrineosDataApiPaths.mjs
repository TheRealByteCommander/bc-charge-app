/**
 * CitrineOS REST path dual-map for PR #849 (drop `/data/**`).
 *
 * Pin 1.8.4 still serves the legacy Data API. #849 is merged on upstream `next`
 * (2026-08-18; not in v2.0.0-beta3 tag) and moves the same operations under
 * `/commands/*`. Call sites should use `resolveDataApiPathCandidates` +
 * try-fallback fetch so both surfaces work across pin and next.
 *
 * @see https://github.com/citrineos/citrineos-core/pull/849
 * @see ../contracts/citrineosDataApiMigration.mjs
 */

import { safeParseResponseJson } from './safeJson.mjs';

/** @typedef {'legacy' | 'commands' | 'auto'} CitrineosRestSurface */

/**
 * @typedef {{
 *   id: string;
 *   legacy: string;
 *   legacyAlt?: string,
 *   commands: string,
 * }} DataApiPathPair
 *
 * legacyAlt = optional alternate legacy path from upstream docs.
 */

/** @type {Record<string, DataApiPathPair>} */
export const CITRINEOS_DATA_API_PATHS = Object.freeze({
  getTransaction: Object.freeze({
    id: 'getTransaction',
    // BC pin 1.8.4 call site (transactionType namespace).
    legacy: '/data/transactions/transactionType',
    // Upstream #849 mapping table lists the pre-drop path as transaction.
    legacyAlt: '/data/transactions/transaction',
    commands: '/commands/transaction',
  }),
  getTariffs: Object.freeze({
    id: 'getTariffs',
    legacy: '/data/transactions/tariff',
    commands: '/commands/tariff',
  }),
  getBootConfig: Object.freeze({
    id: 'getBootConfig',
    legacy: '/data/configuration/bootConfig',
    commands: '/commands/bootConfig',
  }),
});

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {CitrineosRestSurface}
 */
export function resolveCitrineosRestSurface(env = process.env) {
  const raw = String(env.CITRINEOS_REST_SURFACE ?? 'auto').trim().toLowerCase();
  if (raw === 'legacy' || raw === 'data' || raw === 'data-api') return 'legacy';
  if (raw === 'commands' || raw === 'command' || raw === 'v2') return 'commands';
  return 'auto';
}

/**
 * Ordered path candidates for a dual-fetch. `auto` prefers legacy first
 * (pin 1.8.4 default) then commands (#849), so a clean 1.8.4 install never
 * depends on the new surface existing.
 *
 * @param {keyof typeof CITRINEOS_DATA_API_PATHS | string} id
 * @param {{ surface?: CitrineosRestSurface, env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} [opts]
 * @returns {string[]}
 */
export function resolveDataApiPathCandidates(id, opts = {}) {
  const pair = CITRINEOS_DATA_API_PATHS[id];
  if (!pair) return [];
  const surface = opts.surface ?? resolveCitrineosRestSurface(opts.env ?? process.env);

  /** @type {string[]} */
  const legacyFirst = [pair.legacy];
  if (pair.legacyAlt && pair.legacyAlt !== pair.legacy) legacyFirst.push(pair.legacyAlt);

  if (surface === 'legacy') return legacyFirst;
  if (surface === 'commands') return [pair.commands];

  // auto: legacy → commands (safe on 1.8.4; recovers after #849 drop)
  return [...legacyFirst, pair.commands];
}

/**
 * Primary (preferred) path for docs/contract display.
 * @param {keyof typeof CITRINEOS_DATA_API_PATHS | string} id
 * @param {{ surface?: CitrineosRestSurface, env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} [opts]
 */
export function resolvePrimaryDataApiPath(id, opts = {}) {
  const candidates = resolveDataApiPathCandidates(id, opts);
  return candidates[0] ?? null;
}

/**
 * GET JSON from the first candidate path that returns ok + parseable body.
 * 404 / network / empty → try next. Non-404 HTTP errors short-circuit only when
 * `stopOnHttpError` is true (default false so dual-path can recover from 404/410).
 *
 * @param {(path: string, query?: Record<string, unknown>, timeoutMs?: number) => Promise<unknown | null>} getter
 * @param {string[]} pathCandidates
 * @param {Record<string, unknown>} [query]
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ data: unknown | null, path: string | null, tried: string[] }>}
 */
export async function citrineosDualGet(getter, pathCandidates, query, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  /** @type {string[]} */
  const tried = [];
  for (const path of pathCandidates) {
    tried.push(path);
    try {
      const data = await getter(path, query, timeoutMs);
      if (data !== null && data !== undefined) {
        return { data, path, tried };
      }
    } catch {
      // try next candidate
    }
  }
  return { data: null, path: null, tried };
}

/**
 * Fetch helper for routes that need status codes (e.g. tariffs proxy).
 * Tries candidates in order; uses first OK response; on 404/410/405 tries next;
 * otherwise returns the last error response.
 *
 * @param {string} baseUrl no trailing slash
 * @param {string[]} pathCandidates
 * @param {Record<string, string | number | undefined>} [query]
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ ok: boolean, status: number, data: unknown, path: string | null, tried: string[] }>}
 */
export async function citrineosDualFetchJson(baseUrl, pathCandidates, query = {}, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const root = String(baseUrl || '').replace(/\/$/, '');
  /** @type {string[]} */
  const tried = [];
  /** @type {{ ok: boolean, status: number, data: unknown, path: string | null, tried: string[] } | null} */
  let last = null;

  for (const path of pathCandidates) {
    tried.push(path);
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${root}/`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      if (text) {
        const parsed = safeParseResponseJson(text, null);
        data = parsed == null ? { raw: text } : parsed;
      }
      last = { ok: res.ok, status: res.status, data, path, tried: [...tried] };
      if (res.ok) return last;
      // Retry only on "wrong surface" style statuses.
      if (![404, 405, 410, 501].includes(res.status)) return last;
    } catch (e) {
      last = {
        ok: false,
        status: 502,
        data: { error: e instanceof Error ? e.message : 'fetch failed' },
        path,
        tried: [...tried],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return last ?? { ok: false, status: 502, data: { error: 'no path candidates' }, path: null, tried };
}

export default {
  CITRINEOS_DATA_API_PATHS,
  resolveCitrineosRestSurface,
  resolveDataApiPathCandidates,
  resolvePrimaryDataApiPath,
  citrineosDualGet,
  citrineosDualFetchJson,
};
