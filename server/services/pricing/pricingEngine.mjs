/**
 * Pricing Engine – einfache Session-Kostenberechnung (Kompatibilitätsschicht).
 *
 * Quelle: feature/monetization-logic → pricing-engine.ts
 * Angepasst an Cent-sichere money.mjs-Arithmetik.
 *
 * Für vollständige Abrechnung mit TariffSnapshot + OCPP-Events → costEngine.computeCost().
 */

import {
  applyTax,
  moneyFromDecimal,
  moneyToDecimal,
  roundMoneyToCents,
  energyCost,
  timeCost,
} from './money.mjs';

/**
 * @typedef {object} ChargingTariff
 * @property {string} id
 * @property {string} name
 * @property {string|number} energyPricePerKwh – Netto EUR/kWh
 * @property {string|number} sessionFee – Netto EUR
 * @property {string|number} blockFeePerMinute – Netto EUR/Minute Idle
 * @property {number} gracePeriodMinutes – Karenz vor Idle-Gebühr
 * @property {number} [taxRateBp] – Basispunkte, Default 1900 (19 %)
 */

/**
 * @typedef {object} SessionCalculation
 * @property {string} grossTotal
 * @property {string} netTotal
 * @property {string} energyCost
 * @property {string} sessionFeeCost
 * @property {string} blockFeeCost
 * @property {number} totalKwh
 * @property {number} chargingDurationMinutes
 * @property {number} blockingDurationMinutes
 * @property {number} idleBillableMinutes
 */

/**
 * Berechnet Session-Kosten aus kWh, Lade-/Idle-Minuten und Tarif.
 * Idle: nur Minuten oberhalb der Karenz (gracePeriodMinutes).
 *
 * @param {ChargingTariff} tariff
 * @param {number} consumedKwh
 * @param {number} chargingMinutes
 * @param {number} blockingMinutes – Idle-Zeit inkl. Karenz (wie Prototype)
 * @returns {SessionCalculation}
 */
export function calculateSession(tariff, consumedKwh, chargingMinutes, blockingMinutes) {
  const taxRateBp = tariff.taxRateBp ?? 1900;
  const energyRate = moneyFromDecimal(tariff.energyPricePerKwh);
  const sessionFee = moneyFromDecimal(tariff.sessionFee);
  const blockRate = moneyFromDecimal(tariff.blockFeePerMinute);

  const energyWh = Math.round(Number(consumedKwh) * 1000);
  const energy = energyWh > 0 ? energyCost(energyWh, energyRate) : 0n;

  const graceMin = Math.max(0, Number(tariff.gracePeriodMinutes) || 0);
  const blocking = Math.max(0, Number(blockingMinutes) || 0);
  const billableIdleMin = Math.max(0, blocking - graceMin);
  const blockFee =
    billableIdleMin > 0 ? timeCost(Math.round(billableIdleMin * 60), blockRate) : 0n;

  const net = roundMoneyToCents(energy + sessionFee + blockFee);
  const gross = roundMoneyToCents(applyTax(net, taxRateBp));

  return {
    grossTotal: moneyToDecimal(gross),
    netTotal: moneyToDecimal(net),
    energyCost: moneyToDecimal(roundMoneyToCents(energy)),
    sessionFeeCost: moneyToDecimal(roundMoneyToCents(sessionFee)),
    blockFeeCost: moneyToDecimal(roundMoneyToCents(blockFee)),
    totalKwh: Number(consumedKwh),
    chargingDurationMinutes: Number(chargingMinutes) || 0,
    blockingDurationMinutes: blocking,
    idleBillableMinutes: billableIdleMin,
  };
}

/** @deprecated Klassen-API aus dem Prototype – bevorzugt calculateSession() */
export class PricingEngine {
  calculateSession(tariff, consumedKwh, chargingMinutes, blockingMinutes) {
    return calculateSession(tariff, consumedKwh, chargingMinutes, blockingMinutes);
  }
}
