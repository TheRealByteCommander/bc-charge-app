import { Filter, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { StationCard } from '../components/StationCard';
import { useFilteredStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';

export function StationsPage() {
  const stations = useFilteredStations();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const filterAvailableOnly = useAppStore((s) => s.filterAvailableOnly);
  const setFilterAvailableOnly = useAppStore((s) => s.setFilterAvailableOnly);
  const filterConnector = useAppStore((s) => s.filterConnector);
  const setFilterConnector = useAppStore((s) => s.setFilterConnector);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Stationen</h1>
      <input
        className="input-field mt-4"
        placeholder="Name, Stadt oder BC-Code…"
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
        <Filter className="h-4 w-4 text-bc-accent" />
      </button>
      {showFilters && (
        <div className="mt-3 space-y-3 rounded-xl border border-bc-border bg-bc-elevated p-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={filterAvailableOnly}
              onChange={(e) => setFilterAvailableOnly(e.target.checked)}
              className="accent-bc-accent"
            />
            Nur verfügbare Anschlüsse
          </label>
          <div className="flex gap-2">
            {(['all', 'CCS', 'Type2'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterConnector(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  filterConnector === t ? 'bg-bc-accent text-bc-ink' : 'bg-bc-surface text-bc-muted'
                }`}
              >
                {t === 'all' ? 'Alle' : t}
              </button>
            ))}
          </div>
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
