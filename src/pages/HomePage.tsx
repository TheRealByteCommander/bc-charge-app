import {
  ChevronRight,
  History,
  Map,
  MoreHorizontal,
  Navigation,
  QrCode,
  Route,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeMoreSheet } from '../components/sheets/HomeMoreSheet';
import { StationCard } from '../components/StationCard';
import { useNearbyStations } from '../hooks/useStationLists';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { getStations } from '../data/stations';
import { formatCurrency, formatDuration, formatKwh, formatPoints } from '../utils/format';

export function HomePage() {
  const { locale } = useLocale();
  const de = locale === 'de';
  const user = useAppStore((s) => s.user)!;
  const nearby = useNearbyStations(3);
  // Field selectors: home live card needs metrics, but avoid full-object identity churn from unrelated session keys.
  const activeSessionId = useAppStore((s) => s.activeSession?.id ?? null);
  const activeStationName = useAppStore((s) => s.activeSession?.stationName);
  const activeEnergyKwh = useAppStore((s) => s.activeSession?.energyKwh);
  const activeCostEur = useAppStore((s) => s.activeSession?.costEur);
  const activeStartedAt = useAppStore((s) => s.activeSession?.startedAt);
  const sessions = useAppStore((s) => s.sessions);
  const [moreOpen, setMoreOpen] = useState(false);
  const elapsed =
    activeStartedAt ? Math.floor((Date.now() - new Date(activeStartedAt).getTime()) / 1000) : 0;

  const favorites = useMemo(
    () => getStations().filter((s) => user.favoriteStationIds.includes(s.id)).slice(0, 2),
    [user.favoriteStationIds]
  );
  const lastSession = sessions[0];
  const setupNeeded = user.vehicles.length === 0 || user.paymentMethods.length === 0;

  return (
    <div className="page-shell">
      <header className="flex items-end justify-between py-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium tracking-wide text-bc-muted/80">
            {de ? 'WILLKOMMEN ZURÜCK' : 'WELCOME BACK'}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-bc-text">
            {de ? 'Hallo' : 'Hi'}, {user.firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/vorteile"
            className="rounded-full border border-bc-accent/25 bg-bc-accent/10 px-3 py-1.5 text-xs font-bold text-bc-accent"
            aria-label={de ? 'BC Points' : 'BC Points'}
          >
            {formatPoints(user.loyaltyPoints)} pts
          </Link>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="rounded-full p-2 text-bc-muted transition-all duration-200 hover:bg-bc-elevated hover:text-bc-text active:scale-95"
            aria-label={de ? 'Mehr' : 'More'}
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>
        </div>
      </header>

      {setupNeeded && !activeSessionId && (
        <div className="mt-4 rounded-2xl border border-bc-warn/35 bg-bc-warn/10 p-4 text-sm">
          <p className="font-semibold text-bc-text">
            {de ? 'Fast startklar' : 'Almost ready'}
          </p>
          <p className="mt-1 text-bc-muted">
            {de
              ? 'Fahrzeug und Zahlung hinterlegen — dann reicht ein Tap zum Laden.'
              : 'Add a vehicle and payment method — then one tap to charge.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.vehicles.length === 0 && (
              <Link to="/fahrzeuge?returnTo=/" className="btn-secondary px-3 py-2 text-xs">
                {de ? 'Fahrzeug' : 'Vehicle'}
              </Link>
            )}
            {user.paymentMethods.length === 0 && (
              <Link to="/zahlung?returnTo=/" className="btn-secondary px-3 py-2 text-xs">
                {de ? 'Zahlung' : 'Payment'}
              </Link>
            )}
          </div>
        </div>
      )}

      {activeSessionId ? (
        <Link
          to="/laden"
          className="mt-6 group relative block overflow-hidden rounded-3xl border border-bc-accent/30 bg-gradient-to-br from-bc-accent/20 via-bc-surface to-bc-surface p-6 transition-all duration-300 hover:border-bc-accent/50 hover:shadow-glow"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bc-accent opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-bc-accent"></span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-bc-accent">
                {de ? 'Ladevorgang aktiv' : 'Charging active'}
              </p>
            </div>
            <p className="mt-3 font-display text-2xl font-bold leading-tight text-bc-text transition-colors group-hover:text-white">
              {activeStationName}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="font-display text-5xl font-bold tracking-tighter text-bc-accent">
                {formatKwh(activeEnergyKwh ?? 0)}
              </p>
              <span className="text-lg font-medium text-bc-muted">kWh</span>
            </div>
            <p className="mt-2 text-sm font-medium text-bc-muted/70">
              {formatCurrency(activeCostEur ?? 0)} · {formatDuration(elapsed)}
            </p>
            <p className="mt-3 text-xs font-semibold text-bc-accent">
              {de ? 'Tippen für Live-Ansicht →' : 'Tap for live view →'}
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-bc-accent/10 blur-3xl transition-colors group-hover:bg-bc-accent/20" />
        </Link>
      ) : (
        <div className="mt-6 rounded-3xl border border-bc-border bg-bc-elevated p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-bc-accent-soft text-bc-accent">
              <Zap className="h-7 w-7 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold text-bc-text">
                {de ? 'Jetzt laden' : 'Charge now'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-bc-muted">
                {de
                  ? 'QR scannen, ID tippen oder Station in der Nähe wählen.'
                  : 'Scan QR, enter ID, or pick a nearby station.'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link to="/scan" className="btn-primary flex items-center justify-center gap-2 py-3 text-sm">
              <QrCode className="h-4 w-4" />
              {de ? 'Scannen' : 'Scan'}
            </Link>
            <Link to="/karte" className="btn-secondary flex items-center justify-center gap-2 py-3 text-sm">
              <Map className="h-4 w-4" />
              {de ? 'Karte' : 'Map'}
            </Link>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-4 gap-2">
        {(
          [
            { to: '/stationen', icon: Navigation, label: de ? 'Liste' : 'List' },
            { to: '/reise', icon: Route, label: de ? 'Reise' : 'Trip' },
            { to: '/historie', icon: History, label: de ? 'Historie' : 'History' },
            { to: '/vorteile', icon: Sparkles, label: de ? 'Vorteile' : 'Perks' },
          ] as const
        ).map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-bc-border bg-bc-surface/50 px-1 py-3 text-center transition hover:border-bc-accent/40 active:scale-95"
          >
            <Icon className="h-4 w-4 text-bc-accent" />
            <span className="text-[10px] font-semibold text-bc-text">{label}</span>
          </Link>
        ))}
      </div>

      {favorites.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-bc-text">
              {de ? 'Favoriten' : 'Favorites'}
            </h2>
            <Link to="/profil" className="text-sm font-medium text-bc-accent">
              {de ? 'Verwalten' : 'Manage'}
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {favorites.map((s, i) => (
              <StationCard key={s.id} station={s} index={i} compact />
            ))}
          </div>
        </>
      )}

      {nearby.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight text-bc-text">
              {de ? 'In der Nähe' : 'Nearby'}
            </h2>
            <Link
              to="/stationen"
              className="group flex items-center gap-1 text-sm font-medium text-bc-accent transition-colors hover:text-bc-glow"
            >
              {de ? 'Alle' : 'All'}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {nearby.map((s, i) => (
              <StationCard key={s.id} station={s} index={i} compact />
            ))}
          </div>
        </>
      )}

      {lastSession && !activeSessionId && (
        <Link
          to="/historie"
          className="mt-8 block rounded-2xl border border-bc-border bg-bc-surface/40 p-4 transition hover:border-bc-accent/30"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-bc-muted">
            {de ? 'Letzter Ladevorgang' : 'Last session'}
          </p>
          <p className="mt-1 font-semibold text-bc-text">{lastSession.stationName}</p>
          <p className="mt-0.5 text-sm text-bc-muted">
            {formatKwh(lastSession.energyKwh)} kWh · {formatCurrency(lastSession.costEur)}
          </p>
        </Link>
      )}

      <HomeMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        user={user}
        showPlanner={!activeSessionId}
      />
    </div>
  );
}
