import { BatteryCharging, ChevronRight, Route, Search, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChargingPlannerCard } from '../components/ChargingPlannerCard';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { StationCard } from '../components/StationCard';
import { useAccessibility } from '../context/AccessibilityContext';
import { useNearbyStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDuration, formatKwh } from '../utils/format';

export function HomePage() {
  const user = useAppStore((s) => s.user)!;
  const { prefs: a11y } = useAccessibility();
  const nearby = useNearbyStations(a11y.simpleMode ? 2 : 4);
  const activeSession = useAppStore((s) => s.activeSession);
  const elapsed =
    activeSession ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000) : 0;

  return (
    <div className="page-shell">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-bc-muted">Hallo, {user.firstName}</p>
          <h1 className="font-display text-2xl font-bold">BC Charge</h1>
        </div>
        <Link
          to="/laden"
          className={`rounded-full p-3 ${activeSession ? 'bg-bc-accent/20 text-bc-accent' : 'bg-bc-elevated text-bc-muted'}`}
          aria-label="Ladevorgang"
        >
          <BatteryCharging className={`h-6 w-6 ${activeSession ? 'animate-charge' : ''}`} />
        </Link>
      </header>

      {activeSession ? (
        <Link
          to="/laden"
          className="mt-6 block overflow-hidden rounded-2xl border border-bc-accent/40 bg-bc-accent/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-bc-accent">Ladevorgang aktiv</p>
              <p className="mt-1 font-medium">{activeSession.stationName}</p>
              <p className="text-sm text-bc-muted">
                {formatKwh(activeSession.energyKwh)} · {formatCurrency(activeSession.costEur)} ·{' '}
                {formatDuration(elapsed)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-bc-accent" />
          </div>
        </Link>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bc-accent/20 text-bc-accent">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">Ladeplaner</p>
              <p className="text-xs text-bc-muted">Freie Stationen in Ihrer Nähe</p>
            </div>
          </div>
          <ChargingPlannerCard />
        </div>
      )}

      <div className={`mt-6 ${a11y.simpleMode ? 'a11y-hide-simple' : ''}`}>
        <LoyaltyCard user={user} />
      </div>

      <div className={`mt-4 grid grid-cols-3 gap-2 ${a11y.simpleMode ? 'a11y-hide-simple' : ''}`}>
        {[
          { label: 'Geladen', value: `${user.totalKwh.toFixed(0)} kWh` },
          { label: 'CO₂ gespart', value: `${user.co2SavedKg} kg` },
          { label: 'Sessions', value: String(user.totalSessions) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-bc-border bg-bc-elevated p-3 text-center">
            <p className="font-display text-base font-bold">{stat.value}</p>
            <p className="text-[10px] text-bc-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className={`mt-4 grid grid-cols-2 gap-3 ${a11y.simpleMode ? 'grid-cols-1' : ''}`}>
        <Link
          to="/scan"
          className={`btn-primary text-center ${a11y.simpleMode ? 'py-4 text-base' : 'py-3 text-sm'}`}
        >
          Ladepunkt-ID eingeben
        </Link>
        <Link
          to="/karte"
          className={`btn-secondary text-center ${a11y.simpleMode ? 'py-4 text-base' : 'py-3 text-sm'}`}
        >
          Karte öffnen
        </Link>
      </div>

      <Link
        to="/reise"
        className={`a11y-hide-simple mt-3 flex items-center justify-between rounded-xl border border-bc-border bg-bc-elevated px-4 py-3 text-sm`}
      >
        <span className="flex items-center gap-2 text-bc-muted">
          <Route className="h-4 w-4 text-bc-accent" />
          Reise planen
        </span>
        <ChevronRight className="h-4 w-4 text-bc-muted" />
      </Link>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">In der Nähe</h2>
        <Link to="/stationen" className="text-sm font-medium text-bc-accent">
          Alle
        </Link>
      </div>

      <Link
        to="/stationen"
        className={`mt-3 flex items-center gap-3 rounded-xl border border-bc-border bg-bc-elevated px-4 py-3 ${a11y.simpleMode ? 'a11y-hide-simple' : ''}`}
      >
        <Search className="h-5 w-5 shrink-0 text-bc-muted" />
        <span className="text-bc-muted">Station oder Ort suchen…</span>
      </Link>

      <div className="mt-3 space-y-3">
        {nearby.map((s, i) => (
          <StationCard key={s.id} station={s} index={i} />
        ))}
      </div>
    </div>
  );
}
