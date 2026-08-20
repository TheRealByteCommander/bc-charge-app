import { getAvailableCount, getStations } from '../data/stations';
import type { Station, UserProfile } from '../types';
import { asNumberRecord, safeParseJson } from '../utils/safeJson';
import { canSendBrowserNotifications, notifyFavoriteAvailable } from './browserNotifications';

const STORAGE_KEY = 'bc_fav_avail_v1';

function loadState(): Record<string, number> {
  const parsed = safeParseJson<unknown>(sessionStorage.getItem(STORAGE_KEY), {});
  return asNumberRecord(parsed);
}

function saveState(state: Record<string, number>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

/** True when both maps hold the same finite number per key (order-independent). */
export function favoriteAvailabilityStateEqual(
  a: Record<string, number>,
  b: Record<string, number>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function checkFavoriteAvailability(user: UserProfile | null, stations?: Station[]): void {
  if (!user?.notifications.stationAvailability) return;
  if (!canSendBrowserNotifications()) return;
  if (!user.favoriteStationIds.length) return;

  const list = stations ?? getStations();
  const prev = loadState();
  const next: Record<string, number> = { ...prev };

  for (const favId of user.favoriteStationIds) {
    const station = list.find((s) => s.id === favId);
    if (!station) continue;
    const available = getAvailableCount(station);
    const was = prev[favId];
    if (was !== undefined && was === 0 && available > 0) {
      notifyFavoriteAvailable(station, available);
    }
    next[favId] = available;
  }

  // 60s AppShell poll: skip sessionStorage rewrite when counts unchanged.
  if (!favoriteAvailabilityStateEqual(prev, next)) saveState(next);
}
