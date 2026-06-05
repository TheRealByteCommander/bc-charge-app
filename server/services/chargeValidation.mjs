const MAX_RATE_EUR_PER_KWH = 1.25;
const MAX_SESSION_FEE = 4;
const MAX_MINUTE_RATE = 0.15;
const TOLERANCE = 1.12;

export function validateSessionCost({ energyKwh, costEur, pricePerKwh, sessionFee = 0, minutes = 0 }) {
  const kwh = Number(energyKwh);
  const cost = Number(costEur);
  if (!Number.isFinite(kwh) || kwh < 0 || kwh > 200) {
    return 'Ungültige Energiemenge';
  }
  if (!Number.isFinite(cost) || cost < 0) {
    return 'Ungültiger Betrag';
  }
  const rate = Number(pricePerKwh);
  const fee = Number(sessionFee);
  const min = Math.max(0, fee * 0.5);
  const max =
    kwh * Math.max(rate, MAX_RATE_EUR_PER_KWH) +
    Math.max(fee, MAX_SESSION_FEE) +
    minutes * MAX_MINUTE_RATE;
  if (cost < min && kwh > 0.1) {
    return 'Betrag zu niedrig für die geladene Energie';
  }
  if (cost > max * TOLERANCE) {
    return 'Betrag übersteigt den erlaubten Tarifrahmen';
  }
  return null;
}

export function validateChargeCents(amountCents, sessionCostEur) {
  const cents = Math.round(Number(amountCents));
  const expected = Math.round(Number(sessionCostEur) * 100);
  if (!Number.isFinite(cents) || cents < 50) return 'Betrag zu niedrig';
  if (Math.abs(cents - expected) > Math.max(5, expected * 0.05)) {
    return 'Zahlungsbetrag stimmt nicht mit der Sitzung überein';
  }
  return null;
}
