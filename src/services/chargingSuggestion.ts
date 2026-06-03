import { getStations } from '../data/stations';
import { haversineKm } from '../utils/geo';
import type { Connector, Station, Vehicle } from '../types';

export const MAX_NEARBY_STATION_SUGGESTIONS = 2;

export interface ChargeSuggestion {
  station: Station;
  connector: Connector;
  distanceKm: number | null;
}

function connectorFitsVehicle(c: Connector, vehicle: Vehicle): boolean {
  if (c.status !== 'available') return false;
  if (vehicle.preferredConnector === 'CCS' && c.type !== 'CCS') return false;
  if (vehicle.preferredConnector === 'Type2' && c.type === 'CHAdeMO') return false;
  if (c.powerKw < vehicle.maxDcKw * 0.15 && c.type === 'CCS') return false;
  return true;
}

function bestAvailableConnector(station: Station, vehicle?: Vehicle | null): Connector | null {
  const available = station.connectors.filter((c) => {
    if (c.status !== 'available') return false;
    return vehicle ? connectorFitsVehicle(c, vehicle) : true;
  });
  if (!available.length) return null;
  return available.reduce((a, b) => (a.powerKw >= b.powerKw ? a : b));
}

/** Bis zu `limit` nächste Stationen mit freiem (passendem) Anschluss, sortiert nach Entfernung. */
export function pickNearestAvailableStations(
  params: {
    vehicle?: Vehicle | null;
    userLocation: { lat: number; lng: number } | null;
  },
  limit = MAX_NEARBY_STATION_SUGGESTIONS
): ChargeSuggestion[] {
  const { vehicle, userLocation } = params;
  const candidates: (ChargeSuggestion & { sortKey: number })[] = [];

  for (const station of getStations()) {
    const connector = bestAvailableConnector(station, vehicle);
    if (!connector) continue;

    const distanceKm = userLocation
      ? Math.round(haversineKm(userLocation.lat, userLocation.lng, station.lat, station.lng) * 10) / 10
      : null;

    candidates.push({
      station,
      connector,
      distanceKm,
      sortKey: distanceKm ?? Number.POSITIVE_INFINITY,
    });
  }

  candidates.sort((a, b) => a.sortKey - b.sortKey);
  return candidates.slice(0, limit).map(({ sortKey: _sortKey, ...suggestion }) => suggestion);
}

/** Nächste freie Station (Kompatibilität). */
export function pickNearestAvailableStation(
  params: Parameters<typeof pickNearestAvailableStations>[0]
): ChargeSuggestion | null {
  return pickNearestAvailableStations(params, 1)[0] ?? null;
}
