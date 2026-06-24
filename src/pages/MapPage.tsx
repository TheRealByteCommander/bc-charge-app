import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { ChargeMap } from '../components/ChargeMap';
import { BottomSheet } from '../components/BottomSheet';
import { ChargingPlannerCard } from '../components/ChargingPlannerCard';
import { GuestBanner } from '../components/GuestBanner';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { useFilteredStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { countActiveFilters } from '../utils/filterCount';

export function MapPage() {
  const stations = useFilteredStations();
  const user = useAppStore((s) => s.user);
  const loc = useAppStore((s) => s.userLocation);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const center: [number, number] = loc ? [loc.lat, loc.lng] : [51.35, 12.63];
  const activeFilterCount = countActiveFilters(stationFilters);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
      <GuestBanner />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Karte</h1>
          <p className="mt-1 text-sm text-bc-muted">{stations.length} Standorte</p>
        </div>
        <button
          type="button"
          className="relative flex items-center gap-2 rounded-xl border border-bc-border bg-bc-elevated px-3 py-2 text-sm font-medium"
          onClick={() => setShowFilters(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bc-accent px-1 text-[10px] font-bold text-bc-ink">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {user && (
        <div className="mt-3">
          <ChargingPlannerCard compact />
        </div>
      )}

      <div className="mt-4 min-h-[calc(100dvh-11rem)] flex-1">
        <ChargeMap stations={stations} center={center} zoom={10} height="calc(100dvh - 11rem)" />
      </div>

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Stationen filtern">
        <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
      </BottomSheet>
    </div>
  );
}
