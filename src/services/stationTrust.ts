import { getReportsForStation } from './community';
import { formatRelative } from '../utils/format';

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

function loadSuccessLog(): SuccessEntry[] {
  try {
    const raw = localStorage.getItem(SUCCESS_LOG_KEY);
    return raw ? (JSON.parse(raw) as SuccessEntry[]) : [];
  } catch {
    return [];
  }
}

function saveSuccessLog(entries: SuccessEntry[]): void {
  try {
    localStorage.setItem(SUCCESS_LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

export function recordStationSuccess(stationId: string): void {
  const entry: SuccessEntry = { stationId, at: new Date().toISOString() };
  saveSuccessLog([...loadSuccessLog(), entry]);
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
