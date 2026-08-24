import type { Station } from '../types';
import {
  isIndexedDBAvailable,
  loadStationsFromIndexedDB,
  saveStationsToIndexedDB,
} from './indexedDbCache';
import { isPlainObject, safeParseJson } from './safeJson';
import {
  cachedStationsDomainEqual,
  isCachedConnector,
  isCachedStation,
  normalizeCachedStation,
  normalizeCachedStations,
} from './stationCacheShape';

export {
  cachedStationsDomainEqual,
  isCachedConnector,
  isCachedStation,
  normalizeCachedStation,
};

const CACHE_KEY = 'bc_stations_offline_v1';

export function parseStationsOfflineCache(raw: string | null | undefined): {
  savedAt: string;
  source: string;
  stations: Station[];
} | null {
  const parsed = safeParseJson<unknown>(raw, null);
  if (!isPlainObject(parsed) || !Array.isArray(parsed.stations)) return null;
  const stations = normalizeCachedStations(parsed.stations);
  if (stations.length === 0) return null;
  return {
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    source: typeof parsed.source === 'string' ? parsed.source : 'unknown',
    stations,
  };
}

/**
 * Speichert Stationen im Offline-Cache.
 * Nutzt IndexedDB als primären Speicher, localStorage als Fallback.
 */
export async function saveStationsOfflineCache(stations: Station[], source: string): Promise<void> {
  const cleaned = normalizeCachedStations(stations);
  if (isIndexedDBAvailable()) {
    try {
      await saveStationsToIndexedDB(cleaned, source);
      return;
    } catch {
      /* Fallback auf localStorage */
    }
  }

  saveToLocalStorage(cleaned, source);
}

/**
 * Lädt Stationen aus dem Offline-Cache.
 * Versucht zuerst IndexedDB, dann localStorage.
 * IDB helpers already normalize; keep a second pass for defense-in-depth.
 */
export async function loadStationsOfflineCache(): Promise<{
  savedAt: string;
  source: string;
  stations: Station[];
} | null> {
  if (isIndexedDBAvailable()) {
    try {
      const result = await loadStationsFromIndexedDB();
      if (result) {
        const stations = normalizeCachedStations(result.stations);
        if (stations.length > 0) {
          return { ...result, stations };
        }
      }
    } catch {
      /* Fallback auf localStorage */
    }
  }

  return loadFromLocalStorage();
}

/**
 * Synchrone Version für Abwärtskompatibilität (nur localStorage)
 */
export function saveStationsOfflineCacheSync(stations: Station[], source: string): void {
  const cleaned = normalizeCachedStations(stations);
  saveToLocalStorage(cleaned, source);
}

export function loadStationsOfflineCacheSync(): {
  savedAt: string;
  source: string;
  stations: Station[];
} | null {
  return loadFromLocalStorage();
}

function saveToLocalStorage(stations: Station[], source: string): void {
  try {
    // Citrine sync / boot paths poll often: skip rewrite when domain payload + source match
    // (ignore savedAt churn — same family as active-session / fav-availability equal-skip).
    const existing = loadFromLocalStorage();
    if (
      existing &&
      existing.source === source &&
      cachedStationsDomainEqual(existing.stations, stations)
    ) {
      return;
    }
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        source,
        stations,
      })
    );
  } catch {
    /* quota exceeded */
  }
}

function loadFromLocalStorage(): {
  savedAt: string;
  source: string;
  stations: Station[];
} | null {
  return parseStationsOfflineCache(localStorage.getItem(CACHE_KEY));
}
