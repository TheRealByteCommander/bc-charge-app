import type { ChargingSession } from '../types';

/** Round money-like numbers for stable live compare (avoid float noise). */
function money2(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function numOrNull(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

/**
 * True when live meter/pricing fields that drive UI + cache are unchanged.
 * Used by `tickSession` to skip Zustand `set` + sessionStorage writes on identical polls
 * (mirrors server `IS DISTINCT FROM` no-op guards).
 *
 * Intentionally ignores wall-clock-only fields; elapsed UI uses local timers.
 */
export function liveSessionMetricsEqual(
  a: ChargingSession | null | undefined,
  b: ChargingSession | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.stationId === b.stationId &&
    a.connectorId === b.connectorId &&
    a.chargingState === b.chargingState &&
    a.appliedFulfillmentId === b.appliedFulfillmentId &&
    a.rewardLabel === b.rewardLabel &&
    a.citrineosBacked === b.citrineosBacked &&
    numOrNull(a.energyKwh) === numOrNull(b.energyKwh) &&
    numOrNull(a.powerKw) === numOrNull(b.powerKw) &&
    money2(a.costEur) === money2(b.costEur) &&
    money2(a.baseCostEur) === money2(b.baseCostEur) &&
    money2(a.rewardDiscountEur) === money2(b.rewardDiscountEur) &&
    money2(a.pricePerKwh) === money2(b.pricePerKwh) &&
    money2(a.pricePerMin) === money2(b.pricePerMin) &&
    money2(a.sessionFee) === money2(b.sessionFee) &&
    (a.pointsEarned ?? null) === (b.pointsEarned ?? null)
  );
}

/**
 * True when a full session-list refresh can skip Zustand `set` for the active slice:
 * live metrics unchanged and the list still has the same id/status spine (order-sensitive).
 * Used by `refreshActiveSession` after REST re-fetch so history row inserts still apply.
 */
export function sessionListSpineEqual(
  a: readonly Pick<ChargingSession, 'id' | 'status'>[] | null | undefined,
  b: readonly Pick<ChargingSession, 'id' | 'status'>[] | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id || a[i]?.status !== b[i]?.status) return false;
  }
  return true;
}
