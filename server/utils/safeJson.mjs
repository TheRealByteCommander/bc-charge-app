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

/**
 * Best-effort parse of an HTTP response body text.
 * - empty / whitespace → fallback (default null)
 * - valid JSON → parsed value
 * - invalid JSON → fallback (default null); does not throw
 *
 * Prefer this over bare try/JSON.parse in outbound fetch helpers so corrupt
 * upstream bodies degrade consistently.
 *
 * @template T
 * @param {string | null | undefined} text
 * @param {T} [fallback=null]
 * @returns {T | unknown}
 */
export function safeParseResponseJson(text, fallback = null) {
  if (text == null) return fallback;
  if (typeof text !== 'string') return fallback;
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  return safeParseJson(trimmed, fallback);
}

/**
 * Parse response text preferring a plain object; non-object / corrupt → fallback.
 * When parse yields a non-object and fallback is null, returns the parsed value
 * only if you need mixed payloads — use safeParseResponseJson instead.
 *
 * @param {string | null | undefined} text
 * @param {Record<string, unknown> | null} [fallback=null]
 * @returns {unknown}
 */
export function safeParseResponseJsonAllowText(text, fallback = null) {
  if (text == null) return fallback;
  if (typeof text !== 'string') return fallback;
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Upstream sometimes returns plain text errors; keep text when no object expected.
    return trimmed;
  }
}
