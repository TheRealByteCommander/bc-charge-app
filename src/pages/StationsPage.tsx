import { Map, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../components/BottomSheet';
import { StationCard } from '../components/StationCard';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { getStations } from '../data/stations';
import { useFilteredStations } from '../hooks/useStationLists';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { countActiveFilters } from '../utils/filterCount';
import { loadStationsOfflineCache } from '../utils/offlineCache';

export function StationsPage() {
  const { t, locale } = useLocale();
  const de = locale === 'de';
  const stations = useFilteredStations();
  const allStations = getStations();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const activeFilterCount = countActiveFilters(stationFilters);
  const noStationsConfigured = allStations.length === 0;

  useEffect(() => {
    void loadStationsOfflineCache().then((cache) => {
      setOfflineSavedAt(cache?.savedAt ?? null);
    });
  }, []);

  return (
    <div className="page-shell">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t.stations.title}</h1>
          <p className="mt-1 text-xs text-bc-muted">
            {stations.length} {de ? 'Ergebnisse' : 'results'}
            {offlineSavedAt &&
              ` · ${t.stations.cached} ${new Date(offlineSavedAt).toLocaleDateString(
                de ? 'de-DE' : 'en-US'
              )}`}
          </p>
        </div>
        <Link
          to="/karte"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-bc-border bg-bc-elevated px-3 py-2 text-sm font-medium text-bc-text"
        >
          <Map className="h-4 w-4 text-bc-accent" />
          {t.stations.map}
        </Link>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bc-muted" />
        <input
          className="input-field pl-10"
          placeholder={t.stations.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t.stations.search}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStationFilters({ availableOnly: !stationFilters.availableOnly })}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            stationFilters.availableOnly
              ? 'border-bc-accent bg-bc-accent/15 text-bc-accent'
              : 'border-bc-border bg-bc-elevated text-bc-muted'
          }`}
        >
          {t.filters.availableOnly}
        </button>
        {([22, 50, 150] as const).map((kw) => {
          const on = stationFilters.minPowerKw === kw;
          return (
            <button
              key={kw}
              type="button"
              onClick={() => setStationFilters({ minPowerKw: on ? 0 : kw })}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                on
                  ? 'border-bc-accent bg-bc-accent/15 text-bc-accent'
                  : 'border-bc-border bg-bc-elevated text-bc-muted'
              }`}
            >
              ≥{kw} kW
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-bc-border bg-bc-elevated px-3 py-1.5 text-xs font-semibold text-bc-muted"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t.filters.title}
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-bc-accent px-1 text-[10px] font-bold text-bc-ink">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {stations.length === 0 ? (
          <div className="rounded-2xl border border-bc-border bg-bc-elevated p-6 text-center">
            <p className="text-sm text-bc-muted">
              {noStationsConfigured ? t.stations.noStationsConfigured : t.stations.noResults}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-bc-accent"
                onClick={() => useAppStore.getState().resetStationFilters()}
              >
                {t.filters.reset}
              </button>
            )}
          </div>
        ) : (
          stations.map((s, i) => <StationCard key={s.id} station={s} index={i} />)
        )}
      </div>

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title={t.filters.title}>
        <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
      </BottomSheet>
    </div>
  );
}
