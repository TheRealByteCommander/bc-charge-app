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
      <header className="flex items-end justify-between py-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium tracking-wide text-bc-muted/80">WILLKOMMEN ZURÜCK</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-bc-text">Hallo, {user.firstName}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="rounded-full p-2 text-bc-muted transition-all duration-200 hover:bg-bc-elevated hover:text-bc-text active:scale-95"
          aria-label="Mehr"
        >
          <MoreHorizontal className="h-6 w-6" />
        </button>
      </header>

      {activeSession ? (
        <Link
          to="/laden"
          className="mt-8 group relative block overflow-hidden rounded-3xl border border-bc-accent/30 bg-gradient-to-br from-bc-accent/20 via-bc-surface to-bc-surface p-6 transition-all duration-300 hover:border-bc-accent/50 hover:shadow-glow"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bc-accent opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-bc-accent"></span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-bc-accent">Ladevorgang aktiv</p>
            </div>
            <p className="mt-3 font-display text-2xl font-bold leading-tight text-bc-text group-hover:text-white transition-colors">
              {activeSession.stationName}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="font-display text-5xl font-bold tracking-tighter text-bc-accent">{formatKwh(activeSession.energyKwh)}</p>
              <span className="text-lg font-medium text-bc-muted">kWh</span>
            </div>
            <p className="mt-2 text-sm font-medium text-bc-muted/70">
              {formatCurrency(activeSession.costEur)} · {formatDuration(elapsed)}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-bc-accent/10 blur-3xl group-hover:bg-bc-accent/20 transition-colors" />
        </Link>
      ) : (
        <Link
          to="/scan"
          className="mt-8 group relative flex flex-col items-center justify-center rounded-3xl border border-bc-border bg-bc-elevated px-6 py-12 text-center transition-all duration-300 hover:border-bc-accent/40 hover:bg-bc-elevated/80 active:scale-[0.98]"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bc-accent-soft text-bc-accent transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
            <Zap className="h-8 w-8 fill-current" />
          </div>
          <p className="mt-4 font-display text-xl font-semibold text-bc-text">Laden starten</p>
          <p className="mt-1 max-w-xs text-sm text-bc-muted leading-relaxed">
            QR-Code scannen oder Ladepunkt-ID eingeben, um den Vorgang zu beginnen.
          </p>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Link 
          to="/karte" 
          className="group flex items-center justify-center gap-3 rounded-2xl border border-bc-border bg-bc-surface/50 py-4 text-sm font-semibold text-bc-text transition-all duration-200 hover:border-bc-accent/50 hover:bg-bc-elevated active:scale-95"
        >
          <Map className="h-4 w-4 text-bc-accent transition-transform group-hover:scale-110" />
          Karte
        </Link>
        <Link 
          to="/scan" 
          className="group flex items-center justify-center gap-3 rounded-2xl border border-bc-border bg-bc-surface/50 py-4 text-sm font-semibold text-bc-text transition-all duration-200 hover:border-bc-accent/50 hover:bg-bc-elevated active:scale-95"
        >
          <QrCode className="h-4 w-4 text-bc-accent transition-transform group-hover:scale-110" />
          Scannen
        </Link>
      </div>

      {nearby.length > 0 && (
        <>
          <div className="mt-10 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-bc-text">In der Nähe</h2>
            <Link to="/stationen" className="group flex items-center gap-1 text-sm font-medium text-bc-accent transition-colors hover:text-bc-glow">
              Alle Stationen
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
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
