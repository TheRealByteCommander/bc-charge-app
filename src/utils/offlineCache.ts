import type { Station } from '../types';
import {
  isIndexedDBAvailable,
  loadStationsFromIndexedDB,
  saveStationsToIndexedDB,
} from './indexedDbCache';
import { isPlainObject, safeParseJson } from './safeJson';

const CACHE_KEY = 'bc_stations_offline_v1';

/**
 * Speichert Stationen im Offline-Cache.
 * Nutzt IndexedDB als primären Speicher, localStorage als Fallback.
 */
export async function saveStationsOfflineCache(stations: Station[], source: string): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await saveStationsToIndexedDB(stations, source);
      return;
    } catch {
      /* Fallback auf localStorage */
    }
  }

  saveToLocalStorage(stations, source);
}

/**
 * Lädt Stationen aus dem Offline-Cache.
 * Versucht zuerst IndexedDB, dann localStorage.
 */
export async function loadStationsOfflineCache(): Promise<{
  savedAt: string;
  source: string;
  stations: Station[];
} | null> {
  if (isIndexedDBAvailable()) {
    try {
      const result = await loadStationsFromIndexedDB();
      if (result) return result;
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
  saveToLocalStorage(stations, source);
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
  const raw = localStorage.getItem(CACHE_KEY);
  const parsed = safeParseJson<unknown>(raw, null);
  if (!isPlainObject(parsed) || !Array.isArray(parsed.stations)) return null;
  return {
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    source: typeof parsed.source === 'string' ? parsed.source : 'unknown',
    stations: parsed.stations as Station[],
  };
}
