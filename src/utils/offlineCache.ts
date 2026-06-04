import type { Station } from '../types';

const CACHE_KEY = 'bc_stations_offline_v1';

export function saveStationsOfflineCache(stations: Station[], source: string): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        source,
        stations,
      })
    );
  } catch {
    /* quota */
  }
}

export function loadStationsOfflineCache(): {
  savedAt: string;
  source: string;
  stations: Station[];
} | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { savedAt: string; source: string; stations: Station[] };
  } catch {
    return null;
  }
}
