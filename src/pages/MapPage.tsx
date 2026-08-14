import { List, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChargeMap } from '../components/ChargeMap';
import { BottomSheet } from '../components/BottomSheet';
import { GuestBanner } from '../components/GuestBanner';
import { StationFiltersPanel } from '../components/StationFiltersPanel';
import { useFilteredStations } from '../hooks/useStationLists';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { countActiveFilters } from '../utils/filterCount';
import { getAvailableCount } from '../data/stations';

export function MapPage() {
  const { t, locale } = useLocale();
  const de = locale === 'de';
  const stations = useFilteredStations();
  const loc = useAppStore((s) => s.userLocation);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const stationFilters = useAppStore((s) => s.stationFilters);
  const setStationFilters = useAppStore((s) => s.setStationFilters);
  const [showFilters, setShowFilters] = useState(false);
  const center: [number, number] = loc ? [loc.lat, loc.lng] : [51.35, 12.63];
  const activeFilterCount = countActiveFilters(stationFilters);
  const freeCount = useMemo(
    () => stations.reduce((n, s) => n + getAvailableCount(s), 0),
    [stations]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
      <GuestBanner />
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t.stations.map}</h1>
          <p className="mt-0.5 text-xs text-bc-muted">
            {stations.length} {de ? 'Stationen' : 'stations'}
            {freeCount > 0 ? ` · ${freeCount} ${de ? 'frei' : 'free'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/stationen"
            className="flex items-center gap-1.5 rounded-full border border-bc-border bg-bc-elevated px-3 py-2 text-sm font-medium text-bc-text"
          >
            <List className="h-4 w-4" />
            {de ? 'Liste' : 'List'}
          </Link>
          <button
            type="button"
            className="relative flex items-center gap-2 rounded-full border border-bc-border bg-bc-elevated px-4 py-2 text-sm font-medium"
            onClick={() => setShowFilters(true)}
            aria-label={t.filters.title}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bc-accent px-1 text-[10px] font-bold text-bc-ink">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bc-muted" />
        <input
          className="input-field pl-10"
          placeholder={t.stations.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t.stations.search}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
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
      </div>

      <div className="mt-3 min-h-[calc(100dvh-13rem)] flex-1">
        <ChargeMap stations={stations} center={center} zoom={10} height="calc(100dvh - 13rem)" />
      </div>

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title={t.filters.title}>
        <StationFiltersPanel filters={stationFilters} onChange={setStationFilters} />
      </BottomSheet>
    </div>
  );
}
