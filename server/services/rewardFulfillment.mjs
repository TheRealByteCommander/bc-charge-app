import { randomBytes } from 'crypto';
import {
  getRewardDefinition,
  isChargingFulfillmentType,
} from './rewardCatalog.mjs';

function generateId(prefix) {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

function generateVoucherCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes(1)[0] % chars.length];
  }
  return code;
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function buildFulfillmentRecord({ userId, rewardId, redeemedAt = new Date().toISOString() }) {
  const def = getRewardDefinition(rewardId);
  if (!def) {
    throw new Error('Unbekannte Prämie.');
  }

  const expiresAt = addDays(redeemedAt, def.validityDays);
  const base = {
    id: generateId('ful'),
    userId,
    rewardId,
    type: def.fulfillmentType,
    status: 'active',
    redeemedAt,
    expiresAt,
    usedAt: null,
    sessionId: null,
    payload: { ...def.payload },
  };

  if (def.fulfillmentType === 'voucher') {
    base.payload.voucherCode = generateVoucherCode(def.payload.voucherPrefix);
  }

  if (def.fulfillmentType === 'priority_support') {
    base.payload.prioritySupportUntil = addDays(redeemedAt, def.payload.durationDays);
  }

  if (def.fulfillmentType === 'night_points') {
    base.payload.nightPointsUntil = addDays(redeemedAt, def.validityDays);
  }

  return base;
}

export function isFulfillmentActive(fulfillment, now = new Date()) {
  if (!fulfillment || fulfillment.status !== 'active') return false;
  if (fulfillment.expiresAt && new Date(fulfillment.expiresAt) < now) return false;
  return true;
}

export function listActiveChargingFulfillments(fulfillments) {
  return fulfillments.filter(
    (f) => isFulfillmentActive(f) && isChargingFulfillmentType(f.type)
  );
}

/** Grundkosten ohne Prämie (nur Energie + Gebühren). */
export function calcBaseSessionCost({ energyKwh, pricePerKwh, sessionFee = 0, pricePerMin = 0, minutes = 0 }) {
  const kwh = Number(energyKwh) || 0;
  const rate = Number(pricePerKwh) || 0;
  const fee = Number(sessionFee) || 0;
  const perMin = Number(pricePerMin) || 0;
  const min = Number(minutes) || 0;
  const cost = kwh * rate + fee + perMin * min;
  return Math.round(cost * 100) / 100;
}

export function applyChargingFulfillment({
  energyKwh,
  pricePerKwh,
  sessionFee = 0,
  pricePerMin = 0,
  minutes = 0,
  fulfillment,
}) {
  const baseCostEur = calcBaseSessionCost({ energyKwh, pricePerKwh, sessionFee, pricePerMin, minutes });
  if (!fulfillment || !isFulfillmentActive(fulfillment)) {
    return {
      baseCostEur,
      costEur: baseCostEur,
      rewardDiscountEur: 0,
      appliedFulfillmentId: null,
      rewardLabel: null,
    };
  }

  let discountEur = 0;
  let rewardLabel = null;

  if (fulfillment.type === 'free_kwh') {
    const freeKwh = Math.min(Number(fulfillment.payload.freeKwh) || 0, Number(energyKwh) || 0);
    discountEur = Math.round(freeKwh * Number(pricePerKwh) * 100) / 100;
    rewardLabel = `${freeKwh} kWh gratis`;
  } else if (fulfillment.type === 'energy_discount') {
    const pct = Number(fulfillment.payload.discountPercent) || 0;
    const energyCost = (Number(energyKwh) || 0) * Number(pricePerKwh);
    discountEur = Math.round(energyCost * (pct / 100) * 100) / 100;
    rewardLabel = `${pct} % Rabatt auf Energie`;
  } else {
    return {
      baseCostEur,
      costEur: baseCostEur,
      rewardDiscountEur: 0,
      appliedFulfillmentId: null,
      rewardLabel: null,
    };
  }

  const costEur = Math.max(Number(sessionFee) || 0, Math.round((baseCostEur - discountEur) * 100) / 100);

  return {
    baseCostEur,
    costEur,
    rewardDiscountEur: Math.round((baseCostEur - costEur) * 100) / 100,
    appliedFulfillmentId: fulfillment.id,
    rewardLabel,
  };
}

export function isNightChargingSession(startedAt) {
  const hour = new Date(startedAt).getHours();
  return hour >= 22 || hour < 6;
}

export function getNightPointsMultiplier(fulfillments, sessionStartedAt) {
  const now = new Date(sessionStartedAt);
  for (const f of fulfillments) {
    if (f.type !== 'night_points' || !isFulfillmentActive(f, now)) continue;
    if (f.payload.nightPointsUntil && new Date(f.payload.nightPointsUntil) < now) continue;
    if (isNightChargingSession(sessionStartedAt)) {
      return Number(f.payload.pointsMultiplier) || 2;
    }
  }
  return 1;
}

export function getPrioritySupportUntil(fulfillments, profile) {
  const fromProfile = profile?.prioritySupportUntil;
  let latest = fromProfile ? new Date(fromProfile) : null;
  for (const f of fulfillments) {
    if (f.type !== 'priority_support' || f.status !== 'active') continue;
    const until = f.payload.prioritySupportUntil;
    if (!until) continue;
    const d = new Date(until);
    if (!latest || d > latest) latest = d;
  }
  return latest && latest > new Date() ? latest.toISOString() : null;
}

export function profilePatchFromFulfillment(fulfillment) {
  if (fulfillment.type === 'priority_support' && fulfillment.payload.prioritySupportUntil) {
    return { prioritySupportUntil: fulfillment.payload.prioritySupportUntil };
  }
  return {};
}

export function shouldConsumeFulfillment(fulfillment) {
  if (!fulfillment) return false;
  const def = getRewardDefinition(fulfillment.rewardId);
  return def?.consumable === true && isChargingFulfillmentType(fulfillment.type);
}
