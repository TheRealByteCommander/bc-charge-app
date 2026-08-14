/**
 * Shared client-edge API parse helpers — parse-don't-cast for fetch JSON.
 * Prefer Zod schemas at call sites; fall back to plain-object / unknown guards.
 */

import { z, type ZodType, type ZodTypeDef } from 'zod';
import { isPlainObject } from '../utils/safeJson';

export class ApiParseError extends Error {
  readonly issues?: z.ZodIssue[];
  readonly parseCause?: unknown;

  constructor(message: string, options?: { cause?: unknown; issues?: z.ZodIssue[] }) {
    super(message);
    this.name = 'ApiParseError';
    this.issues = options?.issues;
    this.parseCause = options?.cause;
  }
}

/** Read body text and JSON.parse once; empty body → undefined. Throws ApiParseError on bad JSON. */
export async function readResponseJson(res: Response): Promise<unknown> {
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw new ApiParseError(`Failed to read response body (HTTP ${res.status})`, { cause: e });
  }
  if (text == null || text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    throw new ApiParseError(`Invalid JSON (HTTP ${res.status})`, { cause: e });
  }
}

/** Best-effort error/message extraction from wire payloads. */
export function errorMessageFromPayload(data: unknown, fallback: string): string {
  if (isPlainObject(data)) {
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    const err = data.error;
    if (isPlainObject(err) && typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
  }
  if (typeof data === 'string' && data.trim()) return data;
  return fallback;
}

/** Zod safeParse → data or ApiParseError (first issue message). */
export function parseWithSchema<Output, Def extends ZodTypeDef, Input>(
  data: unknown,
  schema: ZodType<Output, Def, Input>,
  label = 'response'
): Output {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? ` at ${first.path.join('.')}` : '';
    const msg = first?.message ?? 'schema mismatch';
    throw new ApiParseError(`Invalid ${label}${path}: ${msg}`, {
      cause: result.error,
      issues: result.error.issues,
    });
  }
  return result.data;
}

/**
 * When no schema is provided: accept any JSON value, defaulting empty body to {}.
 * Still avoids trusting res.json() casts — caller owns further narrowing.
 */
export function parseJsonPayload(data: unknown): unknown {
  return data === undefined ? {} : data;
}

/** Require a plain object payload (most BC REST envelopes). */
export function requirePlainObject(data: unknown, label = 'response'): Record<string, unknown> {
  const payload = parseJsonPayload(data);
  if (!isPlainObject(payload)) {
    throw new ApiParseError(`Invalid ${label}: expected object`);
  }
  return payload;
}

/** Optional schema parse, else plain-object guard for object APIs. */
export function parseApiData<T>(
  data: unknown,
  schema: ZodType<T> | undefined,
  label: string,
  opts?: { allowNonObject?: boolean }
): T {
  if (schema) return parseWithSchema(data, schema, label);
  if (opts?.allowNonObject) {
    return parseJsonPayload(data) as T;
  }
  return requirePlainObject(data, label) as T;
}

// --- Common wire envelopes -------------------------------------------------

export const OkEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

export type OkEnvelope = z.infer<typeof OkEnvelopeSchema>;

export const ProxyEnvelopeSchema = z
  .object({
    ok: z.boolean().optional(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type ProxyEnvelope = z.infer<typeof ProxyEnvelopeSchema>;

export const HasuraGraphqlEnvelopeSchema = z
  .object({
    data: z.unknown().optional(),
    errors: z
      .array(
        z
          .object({
            message: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type HasuraGraphqlEnvelope = z.infer<typeof HasuraGraphqlEnvelopeSchema>;
