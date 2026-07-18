import { createHash } from 'crypto';
import { moneyFromDecimal } from './money.mjs';

/** Normalisiert flachen CitrineOS-Tarif in versionierte Komponenten. */
export function citrineosTariffToComponents(tariff) {
  /** @type {import('./types.mjs').TariffComponent[]} */
  const components = [];
  if (tariff?.pricePerKwh != null && Number(tariff.pricePerKwh) > 0) {
    const v = normalizeRate(tariff.pricePerKwh);
    components.push({ kind: 'energy', rate: v, priority: 10 });
  }
  if (tariff?.pricePerMin != null && Number(tariff.pricePerMin) > 0) {
    components.push({ kind: 'time', rate: normalizeRate(tariff.pricePerMin), priority: 20 });
  }
  if (tariff?.pricePerSession != null && Number(tariff.pricePerSession) > 0) {
    components.push({ kind: 'session', rate: normalizeRate(tariff.pricePerSession), priority: 5 });
  }
  return components;
}

function normalizeRate(amount) {
  const n = Number(amount);
  if (Number.isInteger(n) && n >= 20) return (n / 100).toFixed(4);
  return n.toFixed(4);
}

export function buildTariffVersionPayload({
  tariffId,
  version,
  name,
  validFrom,
  validTo = null,
  timezone = 'Europe/Berlin',
  currency = 'EUR',
  taxRateBp = 1900,
  components,
  minPrice = null,
  maxPrice = null,
  citrineosTariffId = null,
  status = 'draft',
}) {
  const body = {
    tariffId,
    version,
    name,
    status,
    validFrom,
    validTo,
    timezone,
    currency,
    taxRateBp,
    components: [...components].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)),
    minPrice,
    maxPrice,
    combinationRule: 'sum_components',
    citrineosTariffId,
  };
  const hash = hashTariffVersion(body);
  return { ...body, hash };
}

export function hashTariffVersion(versionBody) {
  const canonical = JSON.stringify(canonicalize(versionBody));
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(obj) {
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => {
        if (obj[k] !== undefined) acc[k] = canonicalize(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

export function isVersionEffectiveAt(version, instantUtc, zone) {
  const t = new Date(instantUtc).getTime();
  const from = new Date(version.validFrom).getTime();
  if (t < from) return false;
  if (version.validTo && t >= new Date(version.validTo).getTime()) return false;
  return componentAppliesAtLocal(version, instantUtc, zone);
}

function componentAppliesAtLocal(version, instantUtc, zone) {
  void zone;
  void instantUtc;
  return true;
}

export function parseMinMax(version) {
  return {
    min: version.minPrice ? moneyFromDecimal(version.minPrice) : null,
    max: version.maxPrice ? moneyFromDecimal(version.maxPrice) : null,
  };
}
