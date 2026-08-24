import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCachedConnector,
  isCachedStation,
  normalizeCachedStation,
  parseStationsOfflineCache,
  saveStationsOfflineCacheSync,
} from './offlineCache';

const goodConnector = {
  id: 'evse-1-conn-1',
  type: 'CCS',
  powerKw: 22,
  status: 'available',
  evseId: 'DE*BCC*ST1*1*1',
  pricePerKwh: 0.39,
  evseNumber: 1,
  connectorNumber: 1,
};

const goodStation = {
  id: 'ST1',
  evseCode: 'ST1',
  name: 'Hof',
  address: 'Weg 1',
  city: 'Berlin',
  zip: '10115',
  lat: 52.5,
  lng: 13.4,
  amenities: [],
  openingHours: '24/7',
  operator: 'BC Charge',
  network: 'BC Charge',
  rating: 4.8,
  reviewCount: 0,
  imageGradient: 'from-bc-blue/30 to-bc-surface',
  connectors: [goodConnector],
  greenEnergy: true,
  accessible: true,
  chargePointVendor: 'Elinta Charge',
  chargePointModel: 'CityCharge H2',
  hardwareModel: 'CityCharge H2',
  hardwareFeatures: {
    midCertifiedMeters: true,
    dynamicLoadManagement: true,
    ocppVersion: '1.6',
    multiConnector: true,
  },
  citrineosDatabaseId: 12,
};

describe('isCachedConnector', () => {
  it('accepts a well-formed connector', () => {
    expect(isCachedConnector(goodConnector)).toBe(true);
  });

  it('rejects incomplete or invalid connectors', () => {
    expect(isCachedConnector(null)).toBe(false);
    expect(isCachedConnector({ ...goodConnector, id: '' })).toBe(false);
    expect(isCachedConnector({ ...goodConnector, type: 'Schuko' })).toBe(false);
    expect(isCachedConnector({ ...goodConnector, status: 'broken' })).toBe(false);
    expect(isCachedConnector({ ...goodConnector, powerKw: 'nope' })).toBe(false);
  });
});

describe('isCachedStation / normalizeCachedStation', () => {
  it('accepts and normalizes a well-formed station', () => {
    expect(isCachedStation(goodStation)).toBe(true);
    const n = normalizeCachedStation(goodStation);
    expect(n).not.toBeNull();
    expect(n!.id).toBe('ST1');
    expect(n!.operator).toBe('BC Charge');
    expect(n!.connectors).toHaveLength(1);
    expect(n!.hardwareModel).toBe('CityCharge H2');
    expect(n!.citrineosDatabaseId).toBe(12);
  });

  it('drops stations without usable connectors or required fields', () => {
    expect(normalizeCachedStation({ ...goodStation, id: '' })).toBeNull();
    expect(normalizeCachedStation({ ...goodStation, connectors: [] })).toBeNull();
    expect(
      normalizeCachedStation({
        ...goodStation,
        connectors: [{ ...goodConnector, type: 'USB' }],
      })
    ).toBeNull();
    expect(normalizeCachedStation({ ...goodStation, lat: 'x' })).toBeNull();
  });

  it('coerces numeric strings on connectors and keeps defaults', () => {
    const n = normalizeCachedStation({
      ...goodStation,
      rating: '4.5',
      reviewCount: '3',
      openingHours: undefined,
      connectors: [{ ...goodConnector, powerKw: '50', pricePerKwh: '0.5' }],
    });
    expect(n).not.toBeNull();
    expect(n!.rating).toBe(4.5);
    expect(n!.reviewCount).toBe(3);
    expect(n!.openingHours).toBe('24/7');
    expect(n!.connectors[0].powerKw).toBe(50);
    expect(n!.connectors[0].pricePerKwh).toBe(0.5);
  });
});

describe('parseStationsOfflineCache', () => {
  it('returns null for empty/invalid envelopes', () => {
    expect(parseStationsOfflineCache(null)).toBeNull();
    expect(parseStationsOfflineCache('')).toBeNull();
    expect(parseStationsOfflineCache('{')).toBeNull();
    expect(parseStationsOfflineCache(JSON.stringify({ stations: [] }))).toBeNull();
    expect(
      parseStationsOfflineCache(
        JSON.stringify({ stations: [{ id: 'x', connectors: [] }] })
      )
    ).toBeNull();
  });

  it('keeps only valid stations from mixed cache payloads', () => {
    const parsed = parseStationsOfflineCache(
      JSON.stringify({
        savedAt: '2026-08-18T10:00:00.000Z',
        source: 'citrineos',
        stations: [goodStation, { id: 'bad' }, null, 'x'],
      })
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.source).toBe('citrineos');
    expect(parsed!.savedAt).toBe('2026-08-18T10:00:00.000Z');
    expect(parsed!.stations).toHaveLength(1);
    expect(parsed!.stations[0].id).toBe('ST1');
  });
});

describe('saveStationsOfflineCacheSync equal-skip', () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  function stubLocalStorage() {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  }

  it('skips localStorage rewrite when domain payload + source are unchanged', () => {
    stubLocalStorage();
    const station = normalizeCachedStation(goodStation)!;
    saveStationsOfflineCacheSync([station], 'citrineos');
    const first = store.get('bc_stations_offline_v1');
    expect(first).toBeTruthy();
    const firstSavedAt = JSON.parse(first!).savedAt as string;

    saveStationsOfflineCacheSync([{ ...station }], 'citrineos');
    const second = store.get('bc_stations_offline_v1');
    expect(second).toBe(first);
    expect(JSON.parse(second!).savedAt).toBe(firstSavedAt);
  });

  it('rewrites when connector status changes', () => {
    stubLocalStorage();
    const station = normalizeCachedStation(goodStation)!;
    saveStationsOfflineCacheSync([station], 'citrineos');
    const first = store.get('bc_stations_offline_v1');

    const flipped = normalizeCachedStation({
      ...goodStation,
      connectors: [{ ...goodConnector, status: 'occupied' }],
    })!;
    saveStationsOfflineCacheSync([flipped], 'citrineos');
    const second = store.get('bc_stations_offline_v1');
    expect(second).not.toBe(first);
    expect(JSON.parse(second!).stations[0].connectors[0].status).toBe('occupied');
  });
});
