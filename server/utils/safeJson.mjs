/**
 * Shared server JSON helpers for document columns and best-effort storage.
 * Prefer Zod at HTTP/webhook wire edges; use these for DB TEXT/JSONB columns
 * (data_json, profile_json, components_json, payload_json, meta_json, value_json)
 * so corrupt rows degrade instead of throwing.
 */

/**
 * Parse a stored JSON value without throwing.
 * - null/undefined → fallback (default null)
 * - non-string (pg jsonb already decoded) → value as-is
 * - invalid JSON string → fallback
 *
 * @template T
 * @param {unknown} value
 * @param {T} [fallback=null]
 * @returns {T | unknown}
 */
export function safeParseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  if (value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Parse to a plain object (not array). Corrupt / non-object → fallback (default {}).
 *
 * @param {unknown} value
 * @param {Record<string, unknown>} [fallback={}]
 * @returns {Record<string, unknown>}
 */
export function safeParseObject(value, fallback = {}) {
  const parsed = safeParseJson(value, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return /** @type {Record<string, unknown>} */ (parsed);
  }
  return fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? fallback : {};
}
