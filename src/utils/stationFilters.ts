import type { StationFilterState } from '../types/filters';
import type { Connector, Station } from '../types';
import { connectorHasKnownPrice } from './pricing';

function connectorMatchesType(c: Connector, filter: StationFilterState['connector']): boolean {
  if (filter === 'all') return true;
  if (filter === 'NACS') {
    const t = c.type.toLowerCase();
    return t.includes('nacs') || (c.powerKw >= 150 && c.type === 'CCS');
  }
  return c.type === filter;
}

function stationMaxPowerKw(station: Station): number {
  return Math.max(...station.connectors.map((c) => c.powerKw), 0);
}

function stationMinPrice(station: Station): number | null {
  const prices = station.connectors.filter(connectorHasKnownPrice).map((c) => c.pricePerKwh);
  return prices.length ? Math.min(...prices) : null;
}

export function applyStationFilters(stations: Station[], filters: StationFilterState): Station[] {
  let list = [...stations];

  if (filters.networkQuery.trim()) {
    const q = filters.networkQuery.toLowerCase();
    list = list.filter((s) => s.network.toLowerCase().includes(q) || s.operator.toLowerCase().includes(q));
  }

  if (filters.availableOnly) {
    list = list.filter((s) => s.connectors.some((c) => c.status === 'available'));
  }

  if (filters.connector !== 'all') {
    list = list.filter((s) => s.connectors.some((c) => connectorMatchesType(c, filters.connector)));
  }

  if (filters.minPowerKw > 0) {
    list = list.filter((s) => stationMaxPowerKw(s) >= filters.minPowerKw);
  }

  if (filters.maxPricePerKwh != null) {
    list = list.filter((s) => {
      const min = stationMinPrice(s);
      return min == null || min <= filters.maxPricePerKwh!;
    });
  }

  if (filters.greenEnergyOnly) {
    list = list.filter((s) => s.greenEnergy);
  }

  if (filters.accessibleOnly) {
    list = list.filter((s) => s.accessible);
  }

  if (filters.amenityTags.length > 0) {
    list = list.filter((s) =>
      filters.amenityTags.every((tag) =>
        s.amenities.some((a) => a.toLowerCase().includes(tag.toLowerCase()))
      )
    );
  }

  return list;
}

export function searchStations(stations: Station[], query: string): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return stations;
  return stations.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.evseCode.toLowerCase().includes(q) ||
      s.zip.includes(q)
  );
}
