import { getRewardDefinition } from '../data/rewardCatalog';
import type { RewardFulfillment } from '../types';
import { generateId } from '../utils/format';

function generateVoucherCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function buildFulfillmentRecord({
  userId,
  rewardId,
  redeemedAt = new Date().toISOString(),
}: {
  userId: string;
  rewardId: string;
  redeemedAt?: string;
}): RewardFulfillment {
  const def = getRewardDefinition(rewardId);
  if (!def) throw new Error('Unbekannte Prämie.');

  const expiresAt = addDays(redeemedAt, def.validityDays);
  const payload: Record<string, unknown> = { ...def.payload };

  if (def.fulfillmentType === 'voucher') {
    payload.voucherCode = generateVoucherCode(String(payload.voucherPrefix));
  }
  if (def.fulfillmentType === 'priority_support') {
    payload.prioritySupportUntil = addDays(redeemedAt, Number(payload.durationDays) || 30);
  }
  if (def.fulfillmentType === 'night_points') {
    payload.nightPointsUntil = expiresAt;
  }

  return {
    id: generateId('ful'),
    userId,
    rewardId,
    type: def.fulfillmentType,
    status: 'active',
    payload,
    redeemedAt,
    expiresAt,
    usedAt: null,
    sessionId: null,
    isActive: true,
  };
}

export function isFulfillmentActive(fulfillment: RewardFulfillment, now = new Date()): boolean {
  if (!fulfillment || fulfillment.status !== 'active') return false;
  if (fulfillment.expiresAt && new Date(fulfillment.expiresAt) < now) return false;
  return true;
}

export function isChargingFulfillmentType(type: RewardFulfillment['type']): boolean {
  return type === 'free_kwh' || type === 'energy_discount';
}

export function listActiveChargingFulfillments(fulfillments: RewardFulfillment[]): RewardFulfillment[] {
  return fulfillments.filter((f) => isFulfillmentActive(f) && isChargingFulfillmentType(f.type));
}

export function calcBaseSessionCost({
  energyKwh,
  pricePerKwh,
  sessionFee = 0,
  pricePerMin = 0,
  minutes = 0,
}: {
  energyKwh: number;
  pricePerKwh: number;
  sessionFee?: number;
  pricePerMin?: number;
  minutes?: number;
}): number {
  const cost = energyKwh * pricePerKwh + sessionFee + pricePerMin * minutes;
  return Math.round(cost * 100) / 100;
}

export function applyChargingFulfillment({
  energyKwh,
  pricePerKwh,
  sessionFee = 0,
  pricePerMin = 0,
  minutes = 0,
  fulfillment,
}: {
  energyKwh: number;
  pricePerKwh: number;
  sessionFee?: number;
  pricePerMin?: number;
  minutes?: number;
  fulfillment: RewardFulfillment | null | undefined;
}) {
  const baseCostEur = calcBaseSessionCost({ energyKwh, pricePerKwh, sessionFee, pricePerMin, minutes });
  if (!fulfillment || !isFulfillmentActive(fulfillment)) {
    return {
      baseCostEur,
      costEur: baseCostEur,
      rewardDiscountEur: 0,
      appliedFulfillmentId: null as string | null,
      rewardLabel: null as string | null,
    };
  }

  let discountEur = 0;
  let rewardLabel: string | null = null;

  if (fulfillment.type === 'free_kwh') {
    const freeKwh = Math.min(Number(fulfillment.payload.freeKwh) || 0, energyKwh);
    discountEur = Math.round(freeKwh * pricePerKwh * 100) / 100;
    rewardLabel = `${freeKwh} kWh gratis`;
  } else if (fulfillment.type === 'energy_discount') {
    const pct = Number(fulfillment.payload.discountPercent) || 0;
    const energyCost = energyKwh * pricePerKwh;
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

  const costEur = Math.max(sessionFee, Math.round((baseCostEur - discountEur) * 100) / 100);
  return {
    baseCostEur,
    costEur,
    rewardDiscountEur: Math.round((baseCostEur - costEur) * 100) / 100,
    appliedFulfillmentId: fulfillment.id,
    rewardLabel,
  };
}

export function isNightChargingSession(startedAt: string): boolean {
  const hour = new Date(startedAt).getHours();
  return hour >= 22 || hour < 6;
}

export function getNightPointsMultiplier(
  fulfillments: RewardFulfillment[],
  sessionStartedAt: string
): number {
  const now = new Date(sessionStartedAt);
  for (const f of fulfillments) {
    if (f.type !== 'night_points' || !isFulfillmentActive(f, now)) continue;
    const until = f.payload.nightPointsUntil as string | undefined;
    if (until && new Date(until) < now) continue;
    if (isNightChargingSession(sessionStartedAt)) {
      return Number(f.payload.pointsMultiplier) || 2;
    }
  }
  return 1;
}

export function profilePatchFromFulfillment(fulfillment: RewardFulfillment): Partial<{ prioritySupportUntil: string }> {
  if (fulfillment.type === 'priority_support' && fulfillment.payload.prioritySupportUntil) {
    return { prioritySupportUntil: String(fulfillment.payload.prioritySupportUntil) };
  }
  return {};
}

export function shouldConsumeFulfillment(fulfillment: RewardFulfillment): boolean {
  const def = getRewardDefinition(fulfillment.rewardId);
  return Boolean(def?.consumable && isChargingFulfillmentType(fulfillment.type));
}

export function findFulfillmentById(
  fulfillments: RewardFulfillment[],
  id: string | null | undefined
): RewardFulfillment | undefined {
  if (!id) return undefined;
  return fulfillments.find((f) => f.id === id);
}
