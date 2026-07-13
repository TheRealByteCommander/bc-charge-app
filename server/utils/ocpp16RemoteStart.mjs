/** OCPP 1.6 RemoteStart – go-e benötigt oft ein ChargingProfile (Ampere-Limit). */

export function buildOcpp16ChargingProfile(amps) {
  const limit = Math.min(32, Math.max(6, Math.round(amps)));
  return {
    chargingProfileId: 1,
    stackLevel: 0,
    chargingProfilePurpose: 'TxProfile',
    chargingProfileKind: 'Relative',
    chargingSchedule: {
      chargingRateUnit: 'A',
      chargingSchedulePeriod: [{ startPeriod: 0, limit }],
    },
  };
}

export function resolveGoEAmps(powerWatts) {
  const defaultAmps = Number(process.env.BC_GOE_DEFAULT_AMPS ?? 16);
  if (!powerWatts || powerWatts <= 0) return defaultAmps;
  return Math.min(32, Math.max(6, Math.ceil(powerWatts / 230)));
}

export function isGoEVendor(vendor) {
  const v = String(vendor ?? '').toLowerCase();
  return v.includes('go-e') || v.includes('goe');
}

export function buildOcpp16RemoteStartBody({ connectorId, idTag, vendor, maxPowerWatts }) {
  const body = { connectorId, idTag };
  if (isGoEVendor(vendor)) {
    body.chargingProfile = buildOcpp16ChargingProfile(resolveGoEAmps(maxPowerWatts));
  }
  return body;
}
