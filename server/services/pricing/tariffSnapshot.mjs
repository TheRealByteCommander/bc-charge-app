import { createHash, randomUUID } from 'crypto';
import { hashTariffVersion } from './tariffModel.mjs';

/**
 * Erzeugt unveränderlichen TariffSnapshot bei Start/Autorisierung.
 * @param {object} params
 * @param {string} params.sessionId
 * @param {import('./types.mjs').TariffVersion} params.tariffVersion
 * @param {'bc-engine'|'citrineos-import'|'manual'} params.source
 * @param {boolean} [params.midCertified]
 * @param {object[]} [params.meterProofs]
 */
export function createTariffSnapshot({
  sessionId,
  tariffVersion,
  source,
  midCertified = false,
  meterProofs = [],
}) {
  const frozenAt = new Date().toISOString();
  const tariff = structuredClone(tariffVersion);
  const hash = hashTariffVersion({
    tariffId: tariff.tariffId,
    version: tariff.version,
    validFrom: tariff.validFrom,
    validTo: tariff.validTo,
    timezone: tariff.timezone,
    currency: tariff.currency,
    taxRateBp: tariff.taxRateBp,
    components: tariff.components,
    minPrice: tariff.minPrice,
    maxPrice: tariff.maxPrice,
    combinationRule: tariff.combinationRule,
    frozenAt,
  });

  return {
    id: `snap_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    sessionId,
    tariffVersionId: tariff.id,
    hash,
    source,
    frozenAt,
    tariff,
    midCertified,
    meterProofs: meterProofs.map((p) => structuredClone(p)),
  };
}

export function snapshotIntegrityHash(snapshot) {
  const canonical = JSON.stringify({
    id: snapshot.id,
    sessionId: snapshot.sessionId,
    hash: snapshot.hash,
    frozenAt: snapshot.frozenAt,
    tariff: snapshot.tariff,
    meterProofs: snapshot.meterProofs,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
