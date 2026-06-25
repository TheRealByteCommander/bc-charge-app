import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { StationCard } from '../components/StationCard';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { useFilteredStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { countActiveFilters } from '../utils/filterCount';
import { loadStationsOfflineCache } from '../utils/offlineCache';

export function StationsPage() {
  const stations = useFilteredStations();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const offline = loadStationsOfflineCache();
  const activeFilterCount = countActiveFilters(stationFilters);

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Stationen</h1>
      <p className="mt-1 text-xs text-bc-muted">
        {stations.length} Ergebnisse
        {offline && ` · zuletzt offline ${new Date(offline.savedAt).toLocaleDateString('de-DE')}`}
      </p>
      <input
        className="input-field mt-4"
        placeholder="Name, Stadt, PLZ oder BC-Code…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShowFilters(true)}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-bc-border bg-bc-elevated px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2 text-bc-muted">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </span>
        {activeFilterCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bc-accent px-1.5 text-[10px] font-bold text-bc-ink">
            {activeFilterCount}
          </span>
        ) : (
          <span className="text-xs text-bc-accent">Öffnen</span>
        )}
      </button>

      <div className="mt-4 space-y-3">
        {stations.length === 0 ? (
          <p className="rounded-2xl border border-bc-border bg-bc-elevated p-6 text-center text-sm text-bc-muted">
            Keine Stationen für diese Suche oder Filter. Passen Sie die Filter an.
          </p>
        ) : (
          stations.map((s, i) => <StationCard key={s.id} station={s} index={i} />)
        )}
      </div>

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Stationen filtern">
        <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
      </BottomSheet>
    </div>
  );
}
