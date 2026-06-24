import { defaultStationFilters, type StationFilterState } from '../types/filters';

export function countActiveFilters(filters: StationFilterState): number {
  const defaults = defaultStationFilters();
  let n = 0;
  if (filters.availableOnly !== defaults.availableOnly) n++;
  if (filters.connector !== defaults.connector) n++;
  if (filters.minPowerKw !== defaults.minPowerKw) n++;
  if (filters.maxPricePerKwh !== defaults.maxPricePerKwh) n++;
  if (filters.greenEnergyOnly !== defaults.greenEnergyOnly) n++;
  if (filters.accessibleOnly !== defaults.accessibleOnly) n++;
  if (filters.amenityTags.length > 0) n++;
  if (filters.networkQuery.trim()) n++;
  return n;
}
