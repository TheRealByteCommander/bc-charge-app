import { ChevronDown, ChevronRight, MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { normalizeChargingPlan, shouldShowChargeSuggestion } from '../data/chargingPlan';
import {
  MAX_NEARBY_STATION_SUGGESTIONS,
  pickNearestAvailableStations,
  type ChargeSuggestion,
} from '../services/chargingSuggestion';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAppStore } from '../store/appStore';
import type { ChargingPlanPrefs } from '../types';
import { formatConnectorPriceSummary } from '../utils/pricing';

function formatDistanceKm(km: number | null): string {
  return km != null ? `${km} km` : 'Entfernung unbekannt';
}

function SuggestionRow({
  suggestion,
  index,
  showOpenButton,
}: {
  suggestion: ChargeSuggestion;
  index: number;
  showOpenButton?: boolean;
}) {
  return (
    <div className={index > 0 ? 'mt-3 border-t border-bc-accent/20 pt-3' : ''}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-bc-text">{suggestion.station.name}</p>
        {!suggestion.connectorAvailable && (
          <span className="shrink-0 rounded-md bg-bc-warn/15 px-2 py-0.5 text-[10px] font-medium text-bc-warn">
            Belegt
          </span>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-bc-muted">
        <span className="inline-flex items-center gap-1 font-medium text-bc-text">
          <MapPin className="h-3.5 w-3.5 text-bc-accent" />
          {formatDistanceKm(suggestion.distanceKm)}
        </span>
        <span>
          {suggestion.connector.type} · {suggestion.connector.powerKw} kW
        </span>
        <span>{formatConnectorPriceSummary(suggestion.connector)}</span>
      </p>
      {showOpenButton && (
        <Link
          to={`/station/${suggestion.station.id}`}
          className="btn-primary mt-3 block w-full py-2.5 text-center text-sm"
        >
          Station öffnen
        </Link>
      )}
    </div>
  );
}

export function ChargingPlannerCard() {
  const user = useAppStore((s) => s.user);
  const activeSession = useAppStore((s) => s.activeSession);
  const userLocation = useAppStore((s) => s.userLocation);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const { prefs: a11y } = useAccessibility();
  const prefs = normalizeChargingPlan(user?.chargingPlan);
  const vehicle = user?.vehicles[0];
  const expanded = a11y.simpleMode || prefs.expandedOnHome;

  const patchPlan = (patch: Partial<ChargingPlanPrefs>) => {
    const current = useAppStore.getState().user;
    if (!current) return;
    const base = normalizeChargingPlan(current.chargingPlan);
    let next: ChargingPlanPrefs = { ...base, ...patch };
    if (patch.enabled === true) {
      next = { ...next, snoozedUntil: null };
    }
    updateProfile({ chargingPlan: next });
  };

  const suggestions = useMemo(() => {
    if (!user) return [];
    return pickNearestAvailableStations({ vehicle, userLocation }, MAX_NEARBY_STATION_SUGGESTIONS);
  }, [user, vehicle, userLocation, stationDataSource]);

  const showSuggestion = shouldShowChargeSuggestion(prefs, { activeSession: Boolean(activeSession) });
  const hasSuggestions = suggestions.length > 0;

  if (!user) return null;

  const toggleExpanded = () => patchPlan({ expandedOnHome: !prefs.expandedOnHome });

  const headerContent = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          showSuggestion && hasSuggestions ? 'bg-bc-accent/20 text-bc-accent' : 'bg-bc-surface text-bc-muted'
        }`}
      >
        <Navigation className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-bc-text">Nächste freie Stationen</p>
        {(!showSuggestion || !hasSuggestions) && (
          <p className="text-xs text-bc-muted">
            Bis zu {MAX_NEARBY_STATION_SUGGESTIONS} Stationen in Ihrer Nähe
          </p>
        )}
      </div>
      {!a11y.simpleMode &&
        (expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-bc-muted" aria-hidden />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-bc-muted" aria-hidden />
        ))}
    </>
  );

  const header = a11y.simpleMode ? (
    <div className="flex w-full items-center gap-3">{headerContent}</div>
  ) : (
    <button type="button" onClick={toggleExpanded} className="flex w-full items-center gap-3 text-left">
      {headerContent}
    </button>
  );

  const settingsBody = expanded && !a11y.simpleMode ? (
    <div className="mt-4 space-y-4 border-t border-bc-border pt-4">
      <p className="text-sm text-bc-muted leading-relaxed">
        Bis zu {MAX_NEARBY_STATION_SUGGESTIONS} Stationen – zuerst mit freiem Anschluss, sortiert nach Entfernung.
      </p>

      {!vehicle && (
        <p className="text-sm text-bc-warn">
          Optional unter{' '}
          <Link to="/fahrzeuge" className="font-medium text-bc-accent underline">
            Fahrzeuge
          </Link>{' '}
          Anschluss hinterlegen für passendere Vorschläge.
        </p>
      )}

      <label className="flex items-center gap-3 text-sm text-bc-muted">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => patchPlan({ enabled: e.target.checked })}
          className="accent-bc-accent"
        />
        Stationsempfehlung auf der Startseite
      </label>
    </div>
  ) : null;

  const suggestionList =
    showSuggestion && hasSuggestions ? (
      <div
        className={`rounded-xl border border-bc-accent/35 bg-bc-accent/10 p-4 ${expanded ? 'mt-4' : 'mt-3'}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-bc-accent">
          {suggestions.some((s) => s.connectorAvailable)
            ? `In der Nähe · frei (${suggestions.length})`
            : `In der Nähe (${suggestions.length})`}
        </p>
        {suggestions.map((s, i) => (
          <SuggestionRow
            key={s.station.id}
            suggestion={s}
            index={i}
            showOpenButton={expanded || a11y.simpleMode}
          />
        ))}
      </div>
    ) : showSuggestion && !hasSuggestions ? (
      <p className={`text-sm text-bc-muted ${expanded ? 'mt-4' : 'mt-3'}`}>
        Aktuell keine passende Station gefunden.{' '}
        <Link to="/stationen" className="text-bc-accent">
          Alle Stationen
        </Link>
      </p>
    ) : null;

  const compactLinks =
    showSuggestion && hasSuggestions && !expanded ? (
      <div className="mt-3 space-y-2">
        {suggestions.map((s) => (
          <Link
            key={s.station.id}
            to={`/station/${s.station.id}`}
            className="flex items-center justify-between rounded-xl border border-bc-accent/30 bg-bc-accent/5 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium text-bc-accent">{s.station.name}</span>
              <span className="text-bc-muted"> · {formatDistanceKm(s.distanceKm)}</span>
              {!s.connectorAvailable && (
                <span className="text-bc-warn"> · belegt</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-bc-accent" />
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <section
      className={`rounded-2xl border bg-bc-elevated p-4 transition-colors ${
        showSuggestion && hasSuggestions ? 'border-bc-accent/40' : 'border-bc-border'
      }`}
    >
      {header}
      {settingsBody}
      {a11y.simpleMode || expanded ? suggestionList : compactLinks ?? suggestionList}
    </section>
  );
}
