import { getReportsForStation } from './community';
import { formatRelative } from '../utils/format';
import { asArrayOf, isPlainObject, safeParseJson } from '../utils/safeJson';

const SUCCESS_LOG_KEY = 'bc_station_success_log_v1';
const MAX_ENTRIES = 400;

export type TrustLevel = 'verified' | 'good' | 'caution' | 'unknown';

export interface StationTrustInfo {
  level: TrustLevel;
  shortLabel: string;
  detailLabel: string;
  lastSuccessAt: string | null;
}

interface SuccessEntry {
  stationId: string;
  at: string;
}

/** Narrow unknown localStorage rows to SuccessEntry. */
export function isSuccessEntry(value: unknown): value is SuccessEntry {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.stationId === 'string' &&
    value.stationId.length > 0 &&
    typeof value.at === 'string' &&
    value.at.length > 0
  );
}

function loadSuccessLog(): SuccessEntry[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem(SUCCESS_LOG_KEY), []);
  return asArrayOf(parsed, isSuccessEntry);
}

/** Order-sensitive domain equality for local station success-log entries. */
export function stationSuccessLogDomainEqual(
  a: readonly SuccessEntry[] | null | undefined,
  b: readonly SuccessEntry[] | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.stationId !== y.stationId || x.at !== y.at) return false;
  }
  return true;
}

/** Persist station success log (equal-skip when domain snapshot unchanged). */
export function saveStationSuccessLog(entries: SuccessEntry[]): void {
  try {
    const next = entries.slice(-MAX_ENTRIES);
    // Client no-op family: skip rewrite when domain snapshot unchanged
    // (same family as community reports / check-in equal-skip).
    const existing = loadSuccessLog();
    if (stationSuccessLogDomainEqual(existing, next)) return;
    localStorage.setItem(SUCCESS_LOG_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function recordStationSuccess(stationId: string): void {
  const entry: SuccessEntry = { stationId, at: new Date().toISOString() };
  saveStationSuccessLog([...loadSuccessLog(), entry]);
}

export function getLastStationSuccess(stationId: string): string | null {
  const entries = loadSuccessLog().filter((e) => e.stationId === stationId);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (a.at > b.at ? a : b)).at;
}

export function getStationTrust(
  stationId: string,
  options: { liveData?: boolean; availableCount: number; offlineCount?: number }
): StationTrustInfo {
  const reports = getReportsForStation(stationId);
  const recentBad = reports.filter(
    (r) =>
      r.category !== 'other' &&
      Date.now() - new Date(r.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  const lastSuccessAt = getLastStationSuccess(stationId);
  const hoursSinceSuccess = lastSuccessAt
    ? (Date.now() - new Date(lastSuccessAt).getTime()) / 3_600_000
    : null;

  if (recentBad.length >= 2 || (options.offlineCount ?? 0) > 0) {
    return {
      level: 'caution',
      shortLabel: 'Hinweise beachten',
      detailLabel:
        recentBad.length > 0
          ? `${recentBad.length} Community-Hinweis${recentBad.length > 1 ? 'e' : ''} diese Woche`
          : 'Einige Anschlüsse offline',
      lastSuccessAt,
    };
  }

  if (lastSuccessAt && hoursSinceSuccess != null && hoursSinceSuccess < 72) {
    return {
      level: 'verified',
      shortLabel: `Geladen ${formatRelative(lastSuccessAt)}`,
      detailLabel: 'Kürzlich erfolgreiche Ladung bestätigt',
      lastSuccessAt,
    };
  }

  if (options.liveData && options.availableCount > 0) {
    return {
      level: 'good',
      shortLabel: 'Live-Status',
      detailLabel: `${options.availableCount} Anschluss${options.availableCount === 1 ? '' : 'e'} frei · Echtzeit`,
      lastSuccessAt,
    };
  }

  if (options.availableCount > 0) {
    return {
      level: 'good',
      shortLabel: 'Verfügbar',
      detailLabel: lastSuccessAt
        ? `Zuletzt geladen ${formatRelative(lastSuccessAt)}`
        : 'Noch keine bestätigte Ladung in der Community',
      lastSuccessAt,
    };
  }

  return {
    level: 'unknown',
    shortLabel: 'Status prüfen',
    detailLabel: 'Derzeit keine freien Anschlüsse',
    lastSuccessAt,
  };
}

export const trustLevelStyles: Record<
  TrustLevel,
  { badge: string; dot: string }
> = {
  verified: { badge: 'bg-bc-accent/15 text-bc-accent', dot: 'bg-bc-accent' },
  good: { badge: 'bg-bc-elevated text-bc-muted', dot: 'bg-bc-blue' },
  caution: { badge: 'bg-bc-warn/15 text-bc-warn', dot: 'bg-bc-warn' },
  unknown: { badge: 'bg-bc-surface text-bc-muted', dot: 'bg-bc-muted' },
};
