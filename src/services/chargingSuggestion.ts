import { getStations } from '../data/stations';
import { haversineKm, isValidStationPosition } from '../utils/geo';
import type { Connector, Station, Vehicle } from '../types';

export const MAX_NEARBY_STATION_SUGGESTIONS = 2;

export interface ChargeSuggestion {
  station: Station;
  connector: Connector;
  distanceKm: number | null;
  /** true = Anschluss laut Status frei */
  connectorAvailable: boolean;
}

function connectorFitsVehicle(c: Connector, vehicle: Vehicle): boolean {
  if (vehicle.preferredConnector === 'CCS' && c.type !== 'CCS') return false;
  if (vehicle.preferredConnector === 'Type2' && c.type === 'CHAdeMO') return false;
  if (c.powerKw < vehicle.maxDcKw * 0.15 && c.type === 'CCS') return false;
  return true;
}

function pickConnector(
  station: Station,
  vehicle?: Vehicle | null,
  preferAvailable = true
): { connector: Connector; available: boolean } | null {
  const usable = station.connectors.filter((c) => {
    if (c.status === 'offline') return false;
    return vehicle ? connectorFitsVehicle(c, vehicle) : true;
  });
  if (!usable.length) return null;

  const available = usable.filter((c) => c.status === 'available');
  const pool = preferAvailable && available.length > 0 ? available : usable;
  const connector = pool.reduce((a, b) => (a.powerKw >= b.powerKw ? a : b));
  return { connector, available: connector.status === 'available' };
}

/** Bis zu `limit` nächste Stationen mit passendem Anschluss; bevorzugt freie, sonst nächste belegte. */
export function pickNearestAvailableStations(
  params: {
    vehicle?: Vehicle | null;
    userLocation: { lat: number; lng: number } | null;
  },
  limit = MAX_NEARBY_STATION_SUGGESTIONS
): ChargeSuggestion[] {
  const { vehicle, userLocation } = params;
  const withFree: (ChargeSuggestion & { sortKey: number })[] = [];
  const fallback: (ChargeSuggestion & { sortKey: number })[] = [];

  for (const station of getStations()) {
    const distanceKm =
      userLocation && isValidStationPosition(station.lat, station.lng)
        ? Math.round(haversineKm(userLocation.lat, userLocation.lng, station.lat, station.lng) * 10) / 10
        : null;
    const sortKey = distanceKm ?? Number.POSITIVE_INFINITY;

    const freePick = pickConnector(station, vehicle, true);
    if (freePick?.available) {
      withFree.push({
        station,
        connector: freePick.connector,
        distanceKm,
        connectorAvailable: true,
        sortKey,
      });
      continue;
    }

    const anyPick = pickConnector(station, vehicle, false);
    if (anyPick) {
      fallback.push({
        station,
        connector: anyPick.connector,
        distanceKm,
        connectorAvailable: anyPick.available,
        sortKey,
      });
    }
  }

  withFree.sort((a, b) => a.sortKey - b.sortKey);
  fallback.sort((a, b) => a.sortKey - b.sortKey);

  const merged = [...withFree, ...fallback.filter((f) => !withFree.some((w) => w.station.id === f.station.id))];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return merged.slice(0, limit).map(({ sortKey: _sortKey, ...suggestion }) => suggestion);
}

/** Nächste freie Station (Kompatibilität). */
export function pickNearestAvailableStation(
  params: Parameters<typeof pickNearestAvailableStations>[0]
): ChargeSuggestion | null {
  return pickNearestAvailableStations(params, 1)[0] ?? null;
}
