import { BatteryCharging, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChargingPlannerCard } from '../components/ChargingPlannerCard';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { Logo } from '../components/Logo';
import { StationCard } from '../components/StationCard';
import { useNearbyStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDuration, formatKwh } from '../utils/format';

export function HomePage() {
  const user = useAppStore((s) => s.user);
  const nearby = useNearbyStations(4);
  const activeSession = useAppStore((s) => s.activeSession);
  const citrineosConnected = useAppStore((s) => s.citrineosConnected);
  const elapsed =
    activeSession ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000) : 0;

  if (!user) {
    return (
      <div className="page-shell flex flex-col items-center justify-center text-center">
        <Logo size="lg" />
        <p className="mt-6 text-bc-muted">Melden Sie sich an, um alle Funktionen zu nutzen.</p>
        <Link to="/anmelden" className="btn-primary mt-6">
          Anmelden
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-bc-muted">Hallo, {user.firstName}</p>
          <Logo size="sm" />
          {citrineosConnected && (
            <span className="mt-1 inline-block rounded-md bg-bc-accent/15 px-2 py-0.5 text-xs font-medium text-bc-accent">
              CitrineOS live
            </span>
          )}
        </div>
        <Link
          to="/laden"
          className="rounded-full bg-bc-accent/15 p-3 text-bc-accent"
          aria-label="Aktive Ladung"
        >
          <BatteryCharging className={`h-6 w-6 ${activeSession ? 'animate-charge' : ''}`} />
        </Link>
      </header>

      {!activeSession && <ChargingPlannerCard />}

      {activeSession && (
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
      )}

      <div className="mt-6">
        <LoyaltyCard user={user} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Geladen', value: `${user.totalKwh.toFixed(0)} kWh` },
          { label: 'CO₂ gespart', value: `${user.co2SavedKg} kg` },
          { label: 'Sessions', value: String(user.totalSessions) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-bc-border bg-bc-elevated p-3 text-center">
            <p className="font-display text-lg font-bold text-bc-text">{stat.value}</p>
            <p className="text-xs text-bc-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <Link
        to="/stationen"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-bc-border bg-bc-elevated px-4 py-3"
      >
        <Search className="h-5 w-5 text-bc-muted" />
        <span className="text-bc-muted">Station oder Ort suchen…</span>
      </Link>

      <div className="mt-6 flex gap-3">
        <Link to="/scan" className="btn-primary flex-1 text-center">
          QR scannen
        </Link>
        <Link to="/karte" className="btn-secondary flex-1 text-center">
          Karte
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">In der Nähe</h2>
        <Link to="/stationen" className="text-sm font-medium text-bc-accent">
          Alle
        </Link>
      </div>
      <div className="mt-3 space-y-3">
        {nearby.map((s, i) => (
          <StationCard key={s.id} station={s} index={i} />
        ))}
      </div>
    </div>
  );
}
