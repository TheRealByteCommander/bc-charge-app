import { describe, expect, it } from 'vitest';
import {
  cachedStationsDomainEqual,
  isCachedConnector,
  isCachedStation,
  normalizeCachedStation,
  normalizeCachedStations,
  normalizeStationsCacheMeta,
} from './stationCacheShape';

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

describe('stationCacheShape guards', () => {
  it('accepts well-formed connector/station rows', () => {
    expect(isCachedConnector(goodConnector)).toBe(true);
    expect(isCachedStation(goodStation)).toBe(true);
    const n = normalizeCachedStation(goodStation);
    expect(n).not.toBeNull();
    expect(n!.id).toBe('ST1');
    expect(n!.hardwareModel).toBe('CityCharge H2');
  });

  it('drops corrupt IDB-style station batches', () => {
    const mixed = normalizeCachedStations([
      goodStation,
      { id: 'bad' },
      null,
      'x',
      { ...goodStation, id: 'ST2', connectors: [] },
    ]);
    expect(mixed).toHaveLength(1);
    expect(mixed[0].id).toBe('ST1');
  });

  it('normalizes sparse meta with fallback count', () => {
    expect(normalizeStationsCacheMeta(null)).toBeNull();
    expect(normalizeStationsCacheMeta([])).toBeNull();
    const meta = normalizeStationsCacheMeta(
      { key: 'stations_cache', savedAt: '2026-08-20T08:00:00.000Z', source: 'citrineos' },
      3
    );
    expect(meta).toEqual({
      key: 'stations_cache',
      savedAt: '2026-08-20T08:00:00.000Z',
      source: 'citrineos',
      count: 3,
    });
    expect(normalizeStationsCacheMeta({ count: '2', source: 'sync' })?.count).toBe(2);
  });
});

describe('cachedStationsDomainEqual', () => {
  const a = normalizeCachedStation(goodStation)!;
  const b = normalizeCachedStation({
    ...goodStation,
    id: 'ST2',
    evseCode: 'ST2',
    name: 'Other',
  })!;

  it('treats identical domain payloads as equal (order-independent)', () => {
    expect(cachedStationsDomainEqual([a], [a])).toBe(true);
    expect(cachedStationsDomainEqual([a, b], [b, a])).toBe(true);
    expect(cachedStationsDomainEqual([], [])).toBe(true);
  });

  it('detects status / tariff / identity changes', () => {
    const statusFlip = normalizeCachedStation({
      ...goodStation,
      connectors: [{ ...goodConnector, status: 'occupied' }],
    })!;
    const priceFlip = normalizeCachedStation({
      ...goodStation,
      connectors: [{ ...goodConnector, pricePerKwh: 0.55 }],
    })!;
    expect(cachedStationsDomainEqual([a], [statusFlip])).toBe(false);
    expect(cachedStationsDomainEqual([a], [priceFlip])).toBe(false);
    expect(cachedStationsDomainEqual([a], [a, b])).toBe(false);
    expect(cachedStationsDomainEqual([a], [b])).toBe(false);
  });
});
