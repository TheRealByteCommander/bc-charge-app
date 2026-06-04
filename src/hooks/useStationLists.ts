import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/appStore';

function useStationListDeps() {
  return useAppStore(
    useShallow((s) => ({
      userLocation: s.userLocation,
      searchQuery: s.searchQuery,
      stationFilters: s.stationFilters,
      stationDataSource: s.stationDataSource,
    }))
  );
}

export function useFilteredStations() {
  const deps = useStationListDeps();
  return useMemo(
    () => useAppStore.getState().getFilteredStations(),
    [deps.userLocation, deps.searchQuery, deps.stationFilters, deps.stationDataSource]
  );
}

export function useNearbyStations(limit = 5) {
  const deps = useStationListDeps();
  return useMemo(
    () => useAppStore.getState().getNearbyStations(limit),
    [deps.userLocation, deps.searchQuery, deps.stationFilters, deps.stationDataSource, limit]
  );
}
