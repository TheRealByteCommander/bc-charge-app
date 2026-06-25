import { getAvailableCount, getStations } from '../data/stations';
import type { Station, UserProfile } from '../types';
import { canSendBrowserNotifications, notifyFavoriteAvailable } from './browserNotifications';

const STORAGE_KEY = 'bc_fav_avail_v1';

function loadState(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveState(state: Record<string, number>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
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

  saveState(next);
}
