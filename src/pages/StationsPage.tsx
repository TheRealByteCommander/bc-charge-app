import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { StationCard } from '../components/StationCard';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { useFilteredStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { loadStationsOfflineCache } from '../utils/offlineCache';

export function StationsPage() {
  const stations = useFilteredStations();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const offline = loadStationsOfflineCache();

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
        onClick={() => setShowFilters((v) => !v)}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-bc-border px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2 text-bc-muted">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </span>
        <span className="text-bc-accent text-xs font-medium">{showFilters ? '−' : '+'}</span>
      </button>
      {showFilters && (
        <div className="mt-3">
          <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
        </div>
      )}
      <p className="mt-4 text-sm text-bc-muted">{stations.length} Ergebnisse</p>
      <div className="mt-3 space-y-3">
        {stations.map((s, i) => (
          <StationCard key={s.id} station={s} index={i} />
        ))}
      </div>
    </div>
  );
}
