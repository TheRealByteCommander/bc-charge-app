/**
 * Minimal parse-don't-cast guard for inbound CitrineOS / gateway WebSocket frames.
 * LM service stays Zod-free; shape check only drops non-objects and frames without action.
 */

export type CitrineWsEnvelope = {
  action: string;
  stationId?: string;
  uniqueId?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parse a raw WS data buffer/string into a Citrine envelope.
 * Returns null on invalid JSON, non-objects, or missing/blank action.
 */
export function parseCitrineWsEnvelope(raw: unknown): CitrineWsEnvelope | null {
  let text: string;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString('utf8');
  } else if (raw != null && typeof (raw as { toString?: () => string }).toString === 'function') {
    text = (raw as { toString: () => string }).toString();
  } else {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) {
    return null;
  }

  const actionRaw = parsed.action;
  if (actionRaw == null || typeof actionRaw !== 'string') {
    return null;
  }
  const action = actionRaw.trim();
  if (!action) {
    return null;
  }

  const envelope: CitrineWsEnvelope = {
    ...parsed,
    action,
  };

  if (parsed.stationId != null && parsed.stationId !== '') {
    envelope.stationId = String(parsed.stationId);
  }
  if (parsed.uniqueId != null && parsed.uniqueId !== '') {
    envelope.uniqueId = String(parsed.uniqueId);
  }
  if (parsed.payload != null && isPlainObject(parsed.payload)) {
    envelope.payload = parsed.payload;
  } else if (parsed.payload != null) {
    // Drop non-object payload rather than casting
    delete envelope.payload;
  }

  return envelope;
}
