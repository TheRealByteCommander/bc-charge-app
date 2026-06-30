/**
 * IndexedDB-basierter Offline-Cache für Stationen
 * 
 * Vorteile gegenüber localStorage:
 * - Größere Kapazität (50MB+ vs 5-10MB)
 * - Asynchron (blockiert nicht den Main Thread)
 * - Strukturierte Daten ohne JSON-Serialisierung
 */

import type { Station } from '../types';

const DB_NAME = 'bc_charge_offline';
const DB_VERSION = 1;
const STORE_STATIONS = 'stations';
const STORE_META = 'meta';

interface CacheMeta {
  key: string;
  savedAt: string;
  source: string;
  count: number;
}

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
 * Speichert Stationen in IndexedDB
 */
export async function saveStationsToIndexedDB(
  stations: Station[],
  source: string
): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction([STORE_STATIONS, STORE_META], 'readwrite');

    const stationStore = tx.objectStore(STORE_STATIONS);
    stationStore.clear();

    for (const station of stations) {
      stationStore.put(station);
    }

    const metaStore = tx.objectStore(STORE_META);
    const meta: CacheMeta = {
      key: 'stations_cache',
      savedAt: new Date().toISOString(),
      source,
      count: stations.length,
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
 * Lädt Stationen aus IndexedDB
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
    const metaRequest = metaStore.get('stations_cache');

    const meta = await new Promise<CacheMeta | undefined>((resolve, reject) => {
      metaRequest.onsuccess = () => resolve(metaRequest.result);
      metaRequest.onerror = () => reject(metaRequest.error);
    });

    if (!meta) return null;

    const stationStore = tx.objectStore(STORE_STATIONS);
    const stationsRequest = stationStore.getAll();

    const stations = await new Promise<Station[]>((resolve, reject) => {
      stationsRequest.onsuccess = () => resolve(stationsRequest.result);
      stationsRequest.onerror = () => reject(stationsRequest.error);
    });

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
 * Lädt eine einzelne Station nach ID
 */
export async function getStationFromIndexedDB(id: string): Promise<Station | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_STATIONS, 'readonly');
    const store = tx.objectStore(STORE_STATIONS);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Sucht Stationen nach Stadt
 */
export async function searchStationsByCityInIndexedDB(city: string): Promise<Station[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_STATIONS, 'readonly');
    const store = tx.objectStore(STORE_STATIONS);
    const index = store.index('city');
    const request = index.getAll(city);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Gibt Cache-Metadaten zurück
 */
export async function getIndexedDBCacheMeta(): Promise<CacheMeta | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get('stations_cache');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
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
