import { ChevronDown, ChevronRight, MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { defaultChargingPlan, shouldShowChargeSuggestion, snoozeSuggestions } from '../data/chargingPlan';
import {
  MAX_NEARBY_STATION_SUGGESTIONS,
  pickNearestAvailableStations,
  type ChargeSuggestion,
} from '../services/chargingSuggestion';
import { useAppStore } from '../store/appStore';
import type { ChargingPlanPrefs } from '../types';
import { formatConnectorPriceSummary } from '../utils/pricing';

function formatDistanceKm(km: number | null): string {
  return km != null ? `${km} km` : 'Entfernung unbekannt';
}

function suggestionSubtitle(suggestions: ChargeSuggestion[]): string {
  if (suggestions.length === 0) return 'Wir schlagen verfügbare Stationen in Ihrer Nähe vor';
  return suggestions
    .map((s) =>
      s.distanceKm != null ? `${s.station.name} · ${s.distanceKm} km` : s.station.name
    )
    .join(' · ');
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
    <div
      className={
        index > 0 ? 'mt-3 border-t border-bc-accent/20 pt-3' : ''
      }
    >
      <p className="font-medium text-bc-text">{suggestion.station.name}</p>
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

export function ChargingPlannerCard({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  const user = useAppStore((s) => s.user);
  const activeSession = useAppStore((s) => s.activeSession);
  const userLocation = useAppStore((s) => s.userLocation);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const prefs = user?.chargingPlan ?? defaultChargingPlan();
  const vehicle = user?.vehicles[0];
  const expanded = variant === 'page' ? true : prefs.expandedOnHome;

  const patchPlan = (patch: Partial<ChargingPlanPrefs>) => {
    if (!user) return;
    updateProfile({ chargingPlan: { ...prefs, ...patch } });
  };

  const suggestions = useMemo(() => {
    if (!user) return [];
    return pickNearestAvailableStations({ vehicle, userLocation }, MAX_NEARBY_STATION_SUGGESTIONS);
  }, [user, vehicle, userLocation]);

  const showSuggestion = shouldShowChargeSuggestion(prefs, { activeSession: Boolean(activeSession) });
  const hasSuggestions = suggestions.length > 0;

  if (!user) return null;

  const toggleExpanded = () => patchPlan({ expandedOnHome: !prefs.expandedOnHome });

  const header = (
    <button
      type="button"
      onClick={variant === 'home' ? toggleExpanded : undefined}
      className={`flex w-full items-center gap-3 text-left ${variant === 'home' ? '' : 'pointer-events-none'}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          showSuggestion && hasSuggestions ? 'bg-bc-accent/20 text-bc-accent' : 'bg-bc-surface text-bc-muted'
        }`}
      >
        <Navigation className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-bc-text">Nächste freie Stationen</p>
        <p className="text-xs text-bc-muted line-clamp-2">
          {showSuggestion && hasSuggestions
            ? suggestionSubtitle(suggestions)
            : `Bis zu ${MAX_NEARBY_STATION_SUGGESTIONS} verfügbare Stationen in Ihrer Nähe`}
        </p>
      </div>
      {variant === 'home' &&
        (expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-bc-muted" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-bc-muted" />
        ))}
    </button>
  );

  const body = (
    <div className="mt-4 space-y-4 border-t border-bc-border pt-4">
      <p className="text-sm text-bc-muted leading-relaxed">
        Wir zeigen bis zu {MAX_NEARBY_STATION_SUGGESTIONS} BC-Charge-Stationen mit freiem Anschluss –
        sortiert nach Entfernung, passend zu Ihrem Fahrzeugprofil falls hinterlegt.
      </p>

      {!vehicle && (
        <p className="text-sm text-bc-warn">
          Optional unter{' '}
          <Link to="/fahrzeuge" className="font-medium text-bc-accent underline">
            Fahrzeuge
          </Link>{' '}
          Anschluss und Leistung hinterlegen, damit nur passende Stecker vorgeschlagen werden.
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
  );

  const suggestionBlock =
    showSuggestion && hasSuggestions ? (
      <div className="mt-4 rounded-xl border border-bc-accent/35 bg-bc-accent/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-bc-accent">
          In der Nähe · frei ({suggestions.length})
        </p>
        {suggestions.map((s, i) => (
          <SuggestionRow key={s.station.id} suggestion={s} index={i} showOpenButton />
        ))}
        <button
          type="button"
          className="btn-secondary mt-3 w-full py-2.5 text-sm"
          onClick={() => patchPlan({ snoozedUntil: snoozeSuggestions(24) })}
          title="24 Stunden kein Hinweis auf der Startseite"
        >
          Später
        </button>
      </div>
    ) : showSuggestion && !hasSuggestions ? (
      <p className="mt-4 text-sm text-bc-muted">Aktuell keine freie passende Station gefunden.</p>
    ) : null;

  const compactHints =
    !expanded && variant === 'home' && showSuggestion && hasSuggestions ? (
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
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-bc-accent" />
          </Link>
        ))}
      </div>
    ) : null;

  if (variant === 'page') {
    return (
      <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
        {header}
        {body}
        {suggestionBlock}
      </div>
    );
  }

  return (
    <section
      className={`mt-6 rounded-2xl border bg-bc-elevated p-4 transition-colors ${
        showSuggestion && hasSuggestions ? 'border-bc-accent/40' : 'border-bc-border'
      }`}
    >
      {header}
      {expanded && body}
      {compactHints}
      {expanded && suggestionBlock}
      {expanded && variant === 'home' && (
        <Link to="/ladeplanung" className="mt-3 block text-center text-xs text-bc-accent">
          Einstellungen
        </Link>
      )}
    </section>
  );
}
