/**
 * App connector id format: `evse-{evseId}-conn-{connectorId}`
 * Shared by adhoc resolve, price-optimization, and remote-start paths.
 * Rejects NaN / non-finite so callers never send garbage OCPP ids (#954 class).
 */

/**
 * @param {unknown} connectorAppId
 * @returns {{ evseId: number, connectorId: number } | null}
 */
export function parseConnectorRef(connectorAppId) {
  if (connectorAppId == null) return null;
  const s = String(connectorAppId).trim();
  if (!s) return null;

  // Canonical app id: evse-1-conn-2
  const m = /^evse-(\d+)-conn-(\d+)$/i.exec(s);
  if (m) {
    const evseId = Number(m[1]);
    const connectorId = Number(m[2]);
    if (!Number.isFinite(evseId) || !Number.isFinite(connectorId)) return null;
    return { evseId, connectorId };
  }

  // Bare non-negative integer (OCPP 1.6-style connector id only)
  if (/^\d+$/.test(s)) {
    const connectorId = Number(s);
    if (!Number.isFinite(connectorId)) return null;
    return { evseId: 1, connectorId };
  }

  return null;
}
