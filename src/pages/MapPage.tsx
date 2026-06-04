import { useState } from 'react';
import { ChargeMap } from '../components/ChargeMap';
import { GuestBanner } from '../components/GuestBanner';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { useFilteredStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';

export function MapPage() {
  const stations = useFilteredStations();
  const loc = useAppStore((s) => s.userLocation);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const center: [number, number] = loc ? [loc.lat, loc.lng] : [51.35, 12.63];

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
      <GuestBanner />
      <h1 className="font-display text-2xl font-bold">Karte</h1>
      <p className="mt-1 text-sm text-bc-muted">{stations.length} Standorte</p>
      <button
        type="button"
        className="btn-secondary mt-2 py-2 text-sm"
        onClick={() => setShowFilters((v) => !v)}
      >
        Filter {showFilters ? '▲' : '▼'}
      </button>
      {showFilters && (
        <div className="mt-2 max-h-48 overflow-y-auto">
          <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
        </div>
      )}
      <div className="mt-4 min-h-[calc(100dvh-11rem)] flex-1">
        <ChargeMap stations={stations} center={center} zoom={10} height="calc(100dvh - 11rem)" />
      </div>
    </div>
  );
}
