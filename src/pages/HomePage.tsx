import { ChevronRight, Map, MoreHorizontal, QrCode, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeMoreSheet } from '../components/sheets/HomeMoreSheet';
import { StationCard } from '../components/StationCard';
import { useNearbyStations } from '../hooks/useStationLists';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDuration, formatKwh } from '../utils/format';

export function HomePage() {
  const user = useAppStore((s) => s.user)!;
  const nearby = useNearbyStations(2);
  const activeSession = useAppStore((s) => s.activeSession);
  const [moreOpen, setMoreOpen] = useState(false);
  const elapsed =
    activeSession ? Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000) : 0;

  return (
    <div className="page-shell">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-bc-muted">Hallo, {user.firstName}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Laden</h1>
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="rounded-full p-2.5 text-bc-muted transition hover:bg-bc-elevated hover:text-bc-text"
          aria-label="Mehr"
        >
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </header>

      {activeSession ? (
        <Link
          to="/laden"
          className="mt-8 block overflow-hidden rounded-3xl border border-bc-accent/30 bg-gradient-to-br from-bc-accent/20 to-bc-surface p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-bc-accent">Aktiv</p>
          <p className="mt-2 font-display text-2xl font-bold leading-tight">{activeSession.stationName}</p>
          <p className="mt-3 font-display text-4xl font-bold text-bc-accent">{formatKwh(activeSession.energyKwh)}</p>
          <p className="mt-1 text-sm text-bc-muted">
            {formatCurrency(activeSession.costEur)} · {formatDuration(elapsed)}
          </p>
        </Link>
      ) : (
        <Link
          to="/scan"
          className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-bc-border bg-bc-elevated px-6 py-12 text-center transition hover:border-bc-accent/40"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bc-accent/15 text-bc-accent">
            <Zap className="h-8 w-8" />
          </div>
          <p className="mt-4 font-display text-xl font-semibold">Laden starten</p>
          <p className="mt-1 max-w-xs text-sm text-bc-muted">QR-Code scannen oder Ladepunkt-ID eingeben</p>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/karte" className="flex items-center justify-center gap-2 rounded-2xl border border-bc-border bg-bc-elevated py-4 text-sm font-medium">
          <Map className="h-4 w-4 text-bc-accent" />
          Karte
        </Link>
        <Link to="/scan" className="flex items-center justify-center gap-2 rounded-2xl border border-bc-border bg-bc-elevated py-4 text-sm font-medium">
          <QrCode className="h-4 w-4 text-bc-accent" />
          Scannen
        </Link>
      </div>

      {nearby.length > 0 && (
        <>
          <div className="mt-10 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">In der Nähe</h2>
            <Link to="/stationen" className="flex items-center gap-1 text-sm text-bc-accent">
              Alle
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {nearby.map((s, i) => (
              <StationCard key={s.id} station={s} index={i} compact />
            ))}
          </div>
        </>
      )}

      <HomeMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        user={user}
        showPlanner={!activeSession}
      />
    </div>
  );
}
