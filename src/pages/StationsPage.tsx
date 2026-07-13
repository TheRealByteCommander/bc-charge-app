import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { StationCard } from '../components/StationCard';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { getStations } from '../data/stationRegistry';
import { useFilteredStations } from '../hooks/useStationLists';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { countActiveFilters } from '../utils/filterCount';
import { loadStationsOfflineCache } from '../utils/offlineCache';

export function StationsPage() {
  const { t, locale } = useLocale();
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
      <h1 className="font-display text-2xl font-bold">{t.stations.title}</h1>
      <p className="mt-1 text-xs text-bc-muted">
        {stations.length} {locale === 'de' ? 'Ergebnisse' : 'results'}
        {offlineSavedAt && ` · ${t.stations.cached} ${new Date(offlineSavedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US')}`}
      </p>
      <input
        className="input-field mt-4"
        placeholder={t.stations.search}
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
          {t.filters.title}
        </span>
        {activeFilterCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bc-accent px-1.5 text-[10px] font-bold text-bc-ink">
            {activeFilterCount}
          </span>
        ) : (
          <span className="text-xs text-bc-accent">{t.common.add}</span>
        )}
      </button>

      <div className="mt-4 space-y-3">
        {stations.length === 0 ? (
          <div className="rounded-2xl border border-bc-border bg-bc-elevated p-6 text-center">
            <p className="text-sm text-bc-muted">
              {noStationsConfigured ? t.stations.noStationsConfigured : t.stations.noResults}
            </p>
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
