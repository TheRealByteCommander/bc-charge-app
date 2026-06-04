import type { ConnectorType } from '../types';

export type ConnectorFilter = 'all' | ConnectorType | 'NACS';

export interface StationFilterState {
  availableOnly: boolean;
  connector: ConnectorFilter;
  minPowerKw: number;
  maxPricePerKwh: number | null;
  greenEnergyOnly: boolean;
  accessibleOnly: boolean;
  amenityTags: string[];
  networkQuery: string;
}

export const defaultStationFilters = (): StationFilterState => ({
  availableOnly: false,
  connector: 'all',
  minPowerKw: 0,
  maxPricePerKwh: null,
  greenEnergyOnly: false,
  accessibleOnly: false,
  amenityTags: [],
  networkQuery: '',
});

export const AMENITY_FILTER_OPTIONS = [
  'WLAN',
  'Shop',
  'Restaurant',
  'Hotel',
  'Parken',
  'ÖPNV',
  'WC',
] as const;
