/**
 * Shared local/edge JSON helpers — parse without throw; narrow common shapes.
 * Prefer Zod at wire boundaries; use these for localStorage / best-effort caches.
 */

export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** True for non-null plain objects (not arrays). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accept only plain objects whose values are arrays (e.g. sessions-by-user maps). */
export function asRecordOfArrays<T>(value: unknown): Record<string, T[]> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, T[]> = {};
  for (const [k, v] of Object.entries(value)) {
    if (Array.isArray(v)) out[k] = v as T[];
  }
  return out;
}

/**
 * Keep only own keys whose values are finite numbers (e.g. favId → available count).
 * Drops arrays, null, NaN, Infinity, nested objects.
 */
export function asNumberRecord(value: unknown): Record<string, number> {
  if (!isPlainObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Keep array items that pass a type predicate; non-arrays → [].
 * Use after safeParseJson for local list stores (reports, logs, …).
 */
export function asArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (guard(item)) out.push(item);
  }
  return out;
}
