import { AMENITY_FILTER_OPTIONS, defaultStationFilters, type StationFilterState } from '../types/filters';
import { useLocale } from '../i18n/LocaleContext';

const CONNECTOR_OPTIONS = ['all', 'CCS', 'Type2', 'CHAdeMO', 'NACS'] as const;

export function StationFiltersPanel({
  filters,
  onChange,
}: {
  filters: StationFilterState;
  onChange: (patch: Partial<StationFilterState>) => void;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="space-y-4 rounded-xl border border-bc-border bg-bc-elevated p-4">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => onChange({ availableOnly: e.target.checked })}
          className="accent-bc-accent"
        />
        {t.filters.availableOnly}
      </label>

      <div>
        <p className="text-xs font-medium text-bc-muted">{t.filters.connector}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONNECTOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ connector: c })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filters.connector === c ? 'bg-bc-accent text-bc-ink' : 'bg-bc-surface text-bc-muted'
              }`}
            >
              {c === 'all' ? (locale === 'de' ? 'Alle' : 'All') : c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-bc-muted">{t.filters.minPower}</label>
        <input
          type="range"
          min={0}
          max={350}
          step={10}
          value={filters.minPowerKw}
          onChange={(e) => onChange({ minPowerKw: Number(e.target.value) })}
          className="mt-1 w-full accent-bc-accent"
        />
        <p className="text-right text-sm font-medium text-bc-accent">{filters.minPowerKw} kW+</p>
      </div>

      <div>
        <label className="text-xs text-bc-muted">{t.filters.maxPrice}</label>
        <input
          type="range"
          min={0}
          max={80}
          step={1}
          value={filters.maxPricePerKwh != null ? Math.round(filters.maxPricePerKwh * 100) : 80}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ maxPricePerKwh: v >= 80 ? null : v / 100 });
          }}
          className="mt-1 w-full accent-bc-accent"
        />
        <p className="text-right text-sm text-bc-muted">
          {filters.maxPricePerKwh != null
            ? `≤ ${filters.maxPricePerKwh.toFixed(2)} €/kWh`
            : locale === 'de'
              ? 'Kein Limit'
              : 'No limit'}
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={filters.greenEnergyOnly}
          onChange={(e) => onChange({ greenEnergyOnly: e.target.checked })}
          className="accent-bc-accent"
        />
        {t.filters.greenOnly}
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={filters.accessibleOnly}
          onChange={(e) => onChange({ accessibleOnly: e.target.checked })}
          className="accent-bc-accent"
        />
        {t.filters.accessibleOnly}
      </label>

      <div>
        <p className="text-xs font-medium text-bc-muted">{t.filters.amenities}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AMENITY_FILTER_OPTIONS.map((tag) => {
            const on = filters.amenityTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  onChange({
                    amenityTags: on
                      ? filters.amenityTags.filter((t) => t !== tag)
                      : [...filters.amenityTags, tag],
                  })
                }
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  on ? 'bg-bc-accent/20 text-bc-accent' : 'bg-bc-surface text-bc-muted'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <input
        className="input-field text-sm"
        placeholder={locale === 'de' ? 'Netz / Anbieter…' : 'Network / operator…'}
        value={filters.networkQuery}
        onChange={(e) => onChange({ networkQuery: e.target.value })}
      />

      <button
        type="button"
        className="btn-secondary w-full py-2 text-sm"
        onClick={() => onChange(defaultStationFilters())}
      >
        {t.filters.reset}
      </button>
    </div>
  );
}
