import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/appStore';

/** Abhängigkeiten für Stationlisten (kein neues Array im Zustand-Selector). */
function useStationListDeps() {
  return useAppStore(
    useShallow((s) => ({
      userLocation: s.userLocation,
      searchQuery: s.searchQuery,
      filterAvailableOnly: s.filterAvailableOnly,
      filterConnector: s.filterConnector,
      stationDataSource: s.stationDataSource,
    }))
  );
}

export function useFilteredStations() {
  const deps = useStationListDeps();
  return useMemo(
    () => useAppStore.getState().getFilteredStations(),
    [
      deps.userLocation,
      deps.searchQuery,
      deps.filterAvailableOnly,
      deps.filterConnector,
      deps.stationDataSource,
    ]
  );
}

export function useNearbyStations(limit = 5) {
  const deps = useStationListDeps();
  return useMemo(
    () => useAppStore.getState().getNearbyStations(limit),
    [
      deps.userLocation,
      deps.searchQuery,
      deps.filterAvailableOnly,
      deps.filterConnector,
      deps.stationDataSource,
      limit,
    ]
  );
}
