/**
 * IndexedDB-basierter Offline-Cache für Stationen
 *
 * Vorteile gegenüber localStorage:
 * - Größere Kapazität (50MB+ vs 5-10MB)
 * - Asynchron (blockiert nicht den Main Thread)
 * - Strukturierte Daten ohne JSON-Serialisierung
 *
 * Boundary: every read path normalizes via stationCacheShape (parse-don't-cast).
 * Corrupt/partial IDB rows never surface as typed Station[].
 */

import type { Station } from '../types';
import {
  cachedStationsDomainEqual,
  normalizeCachedStation,
  normalizeCachedStations,
  normalizeStationsCacheMeta,
  type StationsCacheMeta,
} from './stationCacheShape';

const DB_NAME = 'bc_charge_offline';
const DB_VERSION = 1;
const STORE_STATIONS = 'stations';
const STORE_META = 'meta';
const META_KEY = 'stations_cache';

export type CacheMeta = StationsCacheMeta;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_STATIONS)) {
        const stationStore = db.createObjectStore(STORE_STATIONS, { keyPath: 'id' });
        stationStore.createIndex('city', 'city', { unique: false });
        stationStore.createIndex('operator', 'operator', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

/**
 * Speichert Stationen in IndexedDB (nur normalisierte, valide Rows).
 */
export async function saveStationsToIndexedDB(
  stations: Station[],
  source: string
): Promise<void> {
  const cleaned = normalizeCachedStations(stations);
  const normalizedSource = typeof source === 'string' && source ? source : 'unknown';
  try {
    // Skip clear+put when domain payload + source are unchanged (polled Citrine sync).
    // Ignores meta.savedAt — mirrors localStorage offline-cache equal-skip.
    const existing = await loadStationsFromIndexedDB();
    if (
      existing &&
      existing.source === normalizedSource &&
      cachedStationsDomainEqual(existing.stations, cleaned)
    ) {
      return;
    }

    const db = await openDatabase();
    const tx = db.transaction([STORE_STATIONS, STORE_META], 'readwrite');

    const stationStore = tx.objectStore(STORE_STATIONS);
    stationStore.clear();

    for (const station of cleaned) {
      stationStore.put(station);
    }

    const metaStore = tx.objectStore(STORE_META);
    const meta: CacheMeta = {
      key: META_KEY,
      savedAt: new Date().toISOString(),
      source: normalizedSource,
      count: cleaned.length,
    };
    metaStore.put(meta);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('[IndexedDB] Speichern fehlgeschlagen, Fallback auf localStorage', error);
    throw error;
  }
}

/**
 * Lädt Stationen aus IndexedDB — drops corrupt rows / meta.
 */
export async function loadStationsFromIndexedDB(): Promise<{
  stations: Station[];
  savedAt: string;
  source: string;
} | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_STATIONS, STORE_META], 'readonly');

    const metaStore = tx.objectStore(STORE_META);
    const metaRequest = metaStore.get(META_KEY);

    const rawMeta = await new Promise<unknown>((resolve, reject) => {
      metaRequest.onsuccess = () => resolve(metaRequest.result);
      metaRequest.onerror = () => reject(metaRequest.error);
    });

    if (rawMeta == null) return null;

    const stationStore = tx.objectStore(STORE_STATIONS);
    const stationsRequest = stationStore.getAll();

    const rawStations = await new Promise<unknown>((resolve, reject) => {
      stationsRequest.onsuccess = () => resolve(stationsRequest.result);
      stationsRequest.onerror = () => reject(stationsRequest.error);
    });

    const stations = normalizeCachedStations(rawStations);
    if (stations.length === 0) return null;

    const meta =
      normalizeStationsCacheMeta(rawMeta, stations.length) ??
      ({
        key: META_KEY,
        savedAt: '',
        source: 'unknown',
        count: stations.length,
      } satisfies CacheMeta);

    return {
      stations,
      savedAt: meta.savedAt,
      source: meta.source,
    };
  } catch (error) {
    console.warn('[IndexedDB] Laden fehlgeschlagen', error);
    return null;
  }
}

/**
 * Lädt eine einzelne Station nach ID (normalized or null).
 */
export async function getStationFromIndexedDB(id: string): Promise<Station | null> {
  if (typeof id !== 'string' || !id) return null;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_STATIONS, 'readonly');
    const store = tx.objectStore(STORE_STATIONS);
    const request = store.get(id);

    const raw = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return normalizeCachedStation(raw);
  } catch {
    return null;
  }
}

/**
 * Sucht Stationen nach Stadt (normalized; corrupt rows dropped).
 */
export async function searchStationsByCityInIndexedDB(city: string): Promise<Station[]> {
  if (typeof city !== 'string' || !city) return [];
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_STATIONS, 'readonly');
    const store = tx.objectStore(STORE_STATIONS);
    const index = store.index('city');
    const request = index.getAll(city);

    const raw = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return normalizeCachedStations(raw);
  } catch {
    return [];
  }
}

/**
 * Gibt Cache-Metadaten zurück (shape-guarded).
 */
export async function getIndexedDBCacheMeta(): Promise<CacheMeta | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(META_KEY);

    const raw = await new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return normalizeStationsCacheMeta(raw);
  } catch {
    return null;
  }
}

/**
 * Löscht den gesamten Cache
 */
export async function clearIndexedDBCache(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_STATIONS, STORE_META], 'readwrite');
    tx.objectStore(STORE_STATIONS).clear();
    tx.objectStore(STORE_META).clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Prüft ob IndexedDB verfügbar ist
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Test-only: reset open-handle cache between suites. */
export function __resetIndexedDbCacheForTests(): void {
  dbPromise = null;
}
