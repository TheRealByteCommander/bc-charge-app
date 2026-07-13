/** OCPP 1.6 RemoteStart – go-e benötigt oft ein ChargingProfile (Ampere-Limit). */

export function buildOcpp16ChargingProfile(amps: number) {
  const limit = Math.min(32, Math.max(6, Math.round(amps)));
  return {
    chargingProfileId: 1,
    stackLevel: 0,
    chargingProfilePurpose: 'TxProfile' as const,
    chargingProfileKind: 'Relative' as const,
    chargingSchedule: {
      chargingRateUnit: 'A' as const,
      chargingSchedulePeriod: [{ startPeriod: 0, limit }],
    },
  };
}

export function resolveGoEAmps(powerKw?: number): number {
  const defaultAmps = 16;
  if (!powerKw || powerKw <= 0) return defaultAmps;
  return Math.min(32, Math.max(6, Math.ceil((powerKw * 1000) / 230)));
}

export function isGoEVendor(vendor?: string | null): boolean {
  const v = String(vendor ?? '').toLowerCase();
  return v.includes('go-e') || v.includes('goe');
}

export function buildOcpp16RemoteStartBody(opts: {
  connectorId: number;
  idTag: string;
  vendor?: string | null;
  powerKw?: number;
}): { connectorId: number; idTag: string; chargingProfile?: ReturnType<typeof buildOcpp16ChargingProfile> } {
  const body: {
    connectorId: number;
    idTag: string;
    chargingProfile?: ReturnType<typeof buildOcpp16ChargingProfile>;
  } = { connectorId: opts.connectorId, idTag: opts.idTag };
  if (isGoEVendor(opts.vendor)) {
    body.chargingProfile = buildOcpp16ChargingProfile(resolveGoEAmps(opts.powerKw));
  }
  return body;
}

/** OCPP 1.6: idTag max. 20 Zeichen. */
export function normalizeIdToken(idToken: string): string {
  const trimmed = idToken.trim();
  if (!trimmed) return '';
  return trimmed.length <= 20 ? trimmed : trimmed.slice(0, 20);
}
