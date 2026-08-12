/**
 * Shared OCPP protocol / hardware heuristics for BC Charge server.
 * Keep in sync with frontend `src/utils/hardwareProtocol.ts` (same token rules).
 *
 * Source of truth for "is this station OCPP 1.6 hardware?" until CitrineOS
 * exposes a reliable protocol field on ChargingStations.
 */

/** @typedef {'CityCharge H2' | 'go-e' | 'generic'} KnownHardwareModel */
/** @typedef {'1.6' | '2.0.1'} OcppVersion */

/**
 * @param {unknown} vendor
 * @param {unknown} model
 * @returns {{
 *   hardwareModel: KnownHardwareModel,
 *   ocppVersion: OcppVersion,
 *   multiConnector: boolean,
 *   isOcpp16: boolean,
 * }}
 */
export function detectHardwareProtocol(vendor, model) {
  const v = String(vendor ?? '').toLowerCase();
  const m = String(model ?? '').toLowerCase();
  const blob = `${v} ${m}`.trim();

  if (
    v.includes('go-e') ||
    v.includes('goe') ||
    m === 'go-e' ||
    m.includes('go_e') ||
    m.includes('go-e') ||
    blob.includes('goe')
  ) {
    return {
      hardwareModel: 'go-e',
      ocppVersion: '1.6',
      multiConnector: false,
      isOcpp16: true,
    };
  }

  if (
    v.includes('elinta') ||
    m.includes('citycharge') ||
    m.includes('city charge') ||
    blob.includes('citycharge h2')
  ) {
    return {
      hardwareModel: 'CityCharge H2',
      ocppVersion: '1.6',
      multiConnector: true,
      isOcpp16: true,
    };
  }

  return {
    hardwareModel: 'generic',
    ocppVersion: '2.0.1',
    multiConnector: false,
    isOcpp16: false,
  };
}

/**
 * @param {{ chargePointVendor?: unknown, chargePointModel?: unknown } | null | undefined} row
 */
export function isOcpp16Station(row) {
  return detectHardwareProtocol(row?.chargePointVendor, row?.chargePointModel).isOcpp16;
}
