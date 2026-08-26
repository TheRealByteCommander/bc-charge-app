/**
 * OCPP 2.0.1 Transaction.ChargingStateEnumType (+ common casing variants).
 * Shared by webhook normalize + REST/Hasura transaction row mapping so lifecycle
 * strings on `state` ("active"/"completed") never poison idle-fee / LM / UI.
 */

const OCPP_CHARGING_STATE_BY_KEY = Object.freeze(
  Object.fromEntries(
    ['Idle', 'EVConnected', 'Charging', 'SuspendedEV', 'SuspendedEVSE'].map((s) => [
      s.toLowerCase(),
      s,
    ])
  )
);

/**
 * Accept only real OCPP charging states; drop session lifecycle strings / garbage.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeOcppChargingState(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return OCPP_CHARGING_STATE_BY_KEY[t.toLowerCase()] ?? null;
}

/**
 * Prefer explicit chargingState / charging_state aliases; never fall back to
 * generic `state` (session lifecycle ≠ OCPP chargingState).
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string | null}
 */
export function readOcppChargingStateFromRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const raw =
    row.chargingState ??
    row.charging_state ??
    // Nested transactionInfo on some REST envelopes
    (row.transactionInfo && typeof row.transactionInfo === 'object'
      ? row.transactionInfo.chargingState ?? row.transactionInfo.charging_state
      : null) ??
    null;
  return normalizeOcppChargingState(raw);
}

export { OCPP_CHARGING_STATE_BY_KEY };
