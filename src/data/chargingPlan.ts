import type { ChargingPlanPrefs } from '../types';

export const defaultChargingPlan = (): ChargingPlanPrefs => ({
  enabled: true,
  snoozedUntil: null,
  expandedOnHome: false,
});

export function normalizeChargingPlan(prefs?: Partial<ChargingPlanPrefs> | null): ChargingPlanPrefs {
  const base = defaultChargingPlan();
  if (!prefs) return base;
  return {
    enabled: prefs.enabled ?? base.enabled,
    snoozedUntil: prefs.snoozedUntil ?? base.snoozedUntil,
    expandedOnHome: prefs.expandedOnHome ?? base.expandedOnHome,
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

export function snoozeSuggestions(hours = 24): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
