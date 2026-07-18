/** Deterministische Geldbeträge: intern 1/10000 EUR (0,0001 €). */

export const MONEY_SCALE = 10_000n;

/** @param {string|number} value EUR als Dezimalstring oder Number */
export function moneyFromDecimal(value) {
  const s = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Ungültiger Geldbetrag: ${value}`);
  }
  const neg = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const padded = (frac + '0000').slice(0, 4);
  const scaled = BigInt(whole) * MONEY_SCALE + BigInt(padded);
  return neg ? -scaled : scaled;
}

export function moneyFromCents(cents) {
  return BigInt(Math.round(Number(cents))) * 100n;
}

export function moneyToDecimal(scaled) {
  const neg = scaled < 0n;
  const abs = neg ? -scaled : scaled;
  const whole = abs / MONEY_SCALE;
  const frac = abs % MONEY_SCALE;
  const fracStr = frac.toString().padStart(4, '0').replace(/0+$/, '');
  const body = fracStr ? `${whole}.${fracStr}` : String(whole);
  return neg ? `-${body}` : body;
}

export function moneyToCents(scaled) {
  return Number((scaled + 50n) / 100n);
}

export function moneyToEur(scaled) {
  return Number(moneyToDecimal(scaled));
}

/** HALF_UP auf Cent-Ebene (für Anzeige/Stripe). */
export function roundMoneyToCents(scaled) {
  return ((scaled + 50n) / 100n) * 100n;
}

/** Energiekosten: energyWh × ratePerKwh (skaliert) / 1000 Wh pro kWh */
export function energyCost(energyWh, ratePerKwhScaled) {
  return (BigInt(energyWh) * ratePerKwhScaled) / 1000n;
}

/** Zeitkosten: durationSeconds × ratePerMinute (skaliert) / 60 */
export function timeCost(durationSeconds, ratePerMinuteScaled) {
  return (BigInt(durationSeconds) * ratePerMinuteScaled) / 60n;
}

export function applyTax(netScaled, taxRateBp) {
  const bp = BigInt(taxRateBp);
  return (netScaled * (10_000n + bp) + 5_000n) / 10_000n;
}

export function clampMoney(scaled, minScaled, maxScaled) {
  if (minScaled != null && scaled < minScaled) return minScaled;
  if (maxScaled != null && scaled > maxScaled) return maxScaled;
  return scaled;
}
