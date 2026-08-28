import { normalizeChargingPlan } from '../data/chargingPlan';
import type { ChargingPlanPrefs, NotificationPrefs, UserProfile } from '../types';

/**
 * Field-equal for notification toggles (client no-op family — a11y/locale parity).
 * Used before demo saveUsers / backend PATCH so identical prefs do not churn identity.
 */
export function notificationPrefsEqual(
  a: NotificationPrefs | null | undefined,
  b: NotificationPrefs | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.sessionComplete === b.sessionComplete &&
    a.promotions === b.promotions &&
    a.stationAvailability === b.stationAvailability &&
    a.loyaltyUpdates === b.loyaltyUpdates
  );
}

/**
 * Field-equal for charging-plan prefs after normalize (default-equivalent counts as equal).
 */
export function chargingPlanPrefsEqual(
  a: ChargingPlanPrefs | Partial<ChargingPlanPrefs> | null | undefined,
  b: ChargingPlanPrefs | Partial<ChargingPlanPrefs> | null | undefined
): boolean {
  const left = normalizeChargingPlan(a);
  const right = normalizeChargingPlan(b);
  return (
    left.enabled === right.enabled &&
    left.snoozedUntil === right.snoozedUntil &&
    left.expandedOnHome === right.expandedOnHome
  );
}

function jsonStableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * True when applying `patch` would not change any provided user fields.
 * Guards chatty UI paths (notifications, chargingPlan expand/snooze) and
 * idempotent Stripe customer re-ensure from minting new user identity / writes.
 */
export function isProfilePatchNoop(user: UserProfile, patch: Partial<UserProfile>): boolean {
  const keys = Object.keys(patch) as (keyof UserProfile)[];
  if (keys.length === 0) return true;

  for (const key of keys) {
    const nextVal = patch[key];
    const prevVal = user[key];

    if (key === 'notifications') {
      if (!notificationPrefsEqual(user.notifications, nextVal as NotificationPrefs)) {
        return false;
      }
      continue;
    }
    if (key === 'chargingPlan') {
      if (
        !chargingPlanPrefsEqual(
          user.chargingPlan,
          nextVal as ChargingPlanPrefs | Partial<ChargingPlanPrefs> | null | undefined
        )
      ) {
        return false;
      }
      continue;
    }
    if (
      key === 'vehicles' ||
      key === 'paymentMethods' ||
      key === 'favoriteStationIds' ||
      key === 'gamification'
    ) {
      if (!jsonStableEqual(prevVal, nextVal)) return false;
      continue;
    }
    if (nextVal !== prevVal) return false;
  }
  return true;
}
