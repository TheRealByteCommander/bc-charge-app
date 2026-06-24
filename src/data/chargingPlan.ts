import type { ChargingPlanPrefs } from '../types';

export const defaultChargingPlan = (): ChargingPlanPrefs => ({
  enabled: true,
  snoozedUntil: null,
  expandedOnHome: true,
});

export function normalizeChargingPlan(prefs?: Partial<ChargingPlanPrefs> | null): ChargingPlanPrefs {
  const base = defaultChargingPlan();
  if (!prefs) return base;
  return {
    enabled: typeof prefs.enabled === 'boolean' ? prefs.enabled : base.enabled,
    snoozedUntil:
      prefs.snoozedUntil === null || typeof prefs.snoozedUntil === 'string'
        ? prefs.snoozedUntil
        : base.snoozedUntil,
    expandedOnHome:
      typeof prefs.expandedOnHome === 'boolean' ? prefs.expandedOnHome : base.expandedOnHome,
  };
}

export function isSuggestionSnoozed(prefs: ChargingPlanPrefs): boolean {
  if (!prefs.snoozedUntil) return false;
  return new Date(prefs.snoozedUntil).getTime() > Date.now();
}

export function shouldShowChargeSuggestion(
  prefs: ChargingPlanPrefs,
  opts: { activeSession: boolean }
): boolean {
  if (!prefs.enabled || opts.activeSession) return false;
  if (isSuggestionSnoozed(prefs)) return false;
  return true;
}
