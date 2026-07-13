import type { Station } from '../types';
import { staticStations } from './staticStations';

export type StationDataSource = 'static' | 'citrineos' | 'offline-cache';

let stationsCache: Station[] = [...staticStations];
let dataSource: StationDataSource = 'static';

export function getStations(): Station[] {
  return stationsCache;
}

export function getStationDataSource(): StationDataSource {
  return dataSource;
}

export function setStationsFromCitrineos(stations: Station[]): void {
  if (stations.length > 0) {
    stationsCache = stations;
    dataSource = 'citrineos';
  }
}

export function resetStationsToStatic(): void {
  stationsCache = [...staticStations];
  dataSource = 'static';
}

export function setStationsFromOfflineCache(stations: Station[]): void {
  if (stations.length > 0) {
    stationsCache = stations;
    dataSource = 'offline-cache';
  }
}

export function getStationById(id: string): Station | undefined {
  return stationsCache.find((s) => s.id === id);
}

export function getStationByEvseCode(code: string): Station | undefined {
  const normalized = code.trim().toUpperCase();
  return stationsCache.find((s) => s.id.toUpperCase() === normalized || s.evseCode === normalized);
}

export function getAvailableCount(station: Station): number {
  return station.connectors.filter((c) => c.status === 'available').length;
}
