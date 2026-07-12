import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ChevronRight, Square, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ChargingDetailsSheet } from '../components/sheets/ChargingDetailsSheet';
import { ConnectorLedStatus } from '../components/ConnectorLedStatus';
import { getStationById } from '../data/stations';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { estimateRemainingChargeMinutes, vehicleTargetKwh } from '../utils/chargeEstimate';
import { formatCurrency, formatDuration, formatKwh, formatPower } from '../utils/format';
import { getChargingStateInfo } from '../utils/ocppStateMapping';

export function ChargingPage() {
  const { t, locale } = useLocale();
  const activeSession = useAppStore((s) => s.activeSession);
  const user = useAppStore((s) => s.user);
  const initialized = useAppStore((s) => s.initialized);
  const refreshActiveSession = useAppStore((s) => s.refreshActiveSession);
  const stopSession = useAppStore((s) => s.stopSession);
  const abandonStuckSession = useAppStore((s) => s.abandonStuckSession);
  const setToast = useAppStore((s) => s.setToast);
  const navigate = useNavigate();
  const [stopping, setStopping] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const tickSession = useAppStore((s) => s.tickSession);

  useEffect(() => {
    if (!initialized || !user || !activeSession) return;
    void refreshActiveSession();
    void tickSession();
  }, [initialized, user, activeSession?.id, refreshActiveSession, tickSession]);

  useEffect(() => {
    if (!initialized || !user || activeSession) return;
    void refreshActiveSession();
  }, [initialized, user, activeSession, refreshActiveSession]);

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28 text-center">
        <Zap className="h-16 w-16 text-bc-muted opacity-40" />
        <h1 className="mt-6 font-display text-xl font-bold">
          {locale === 'de' ? 'Kein aktiver Ladevorgang' : 'No active charging session'}
        </h1>
        <Link to="/scan" className="btn-primary mt-8">
          {locale === 'de' ? 'Laden starten' : 'Start charging'}
        </Link>
      </div>
    );
  }

  const vehicle = user?.vehicles.find((v) => v.id === activeSession.vehicleId);
  const station = getStationById(activeSession.stationId);
  const targetKwh = vehicle ? vehicleTargetKwh(vehicle) : 60;
  const elapsed = Math.floor((now - new Date(activeSession.startedAt).getTime()) / 1000);
  const progress = Math.min(100, (activeSession.energyKwh / targetKwh) * 100);
  const remainingMin = estimateRemainingChargeMinutes(
    activeSession.energyKwh,
    targetKwh,
    activeSession.powerKw
  );
  const chargingStateInfo = getChargingStateInfo(activeSession.chargingState);

  const handleStop = async () => {
    setStopping(true);
    await stopSession();
    setStopping(false);
    navigate('/historie');
  };

  const handleAbandon = async () => {
    if (
      !window.confirm(
        locale === 'de'
          ? 'Ladevorgang wirklich abbrechen? Nutzen Sie dies, wenn „Stoppen“ nicht funktioniert oder die Säule offline ist.'
          : 'Really abandon this session? Use this if Stop does not work or the charger is offline.'
      )
    ) {
      return;
    }
    setAbandoning(true);
    const result = await abandonStuckSession();
    setAbandoning(false);
    if (result.ok) {
      navigate('/historie');
    } else {
      setToast(result.error ?? (locale === 'de' ? 'Abbrechen fehlgeschlagen.' : 'Abandon failed.'));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-28 pt-10">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-bc-accent">
        {chargingStateInfo.isPaused ? chargingStateInfo.label : t.charging.active}
      </p>
      <h1 className="mt-2 text-center font-display text-xl font-semibold leading-snug">
        {activeSession.stationName}
      </h1>
      <p className="text-center text-sm text-bc-muted">
        {formatPower(activeSession.powerKw)} · {formatDuration(elapsed)}
      </p>

      <div className="relative mx-auto mt-10 flex h-60 w-60 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#243040" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={chargingStateInfo.isPaused ? '#f59e0b' : 'url(#grad-charge)'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.76} 276`}
          />
          <defs>
            <linearGradient id="grad-charge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2ee59d" />
              <stop offset="100%" stopColor="#5dffb8" />
            </linearGradient>
          </defs>
        </svg>
        <motion.div
          animate={{ scale: chargingStateInfo.isPaused ? 1 : [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-center"
        >
          <p className="font-display text-5xl font-bold tracking-tight text-bc-text">
            {formatKwh(activeSession.energyKwh)}
          </p>
          <p className="mt-1 text-lg font-semibold text-bc-accent">{formatCurrency(activeSession.costEur)}</p>
        </motion.div>
      </div>

      {station?.hardwareModel === 'CityCharge H2' && (
        <div className="mt-4 flex justify-center">
          <ConnectorLedStatus status="occupied" isH2Hardware className="text-sm" />
        </div>
      )}

      {remainingMin != null && remainingMin > 0 && !chargingStateInfo.isPaused && (
        <p className="mt-6 text-center text-sm text-bc-muted">
          {locale === 'de' ? 'Noch ca.' : 'About'} {remainingMin} {locale === 'de' ? 'Min.' : 'min'}
        </p>
      )}

      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="mx-auto mt-6 flex items-center gap-1 text-sm text-bc-muted transition hover:text-bc-text"
      >
        {locale === 'de' ? 'Details & Hilfe' : 'Details & help'}
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="mt-auto space-y-3 pt-8">
        <button
          type="button"
          className="btn-primary flex w-full items-center justify-center gap-2 bg-bc-danger from-bc-danger to-red-600 py-4 text-base"
          onClick={handleStop}
          disabled={stopping || abandoning}
        >
          <Square className="h-4 w-4" />
          {stopping ? t.common.loading : t.charging.stop}
        </button>
        <button
          type="button"
          className="btn-secondary w-full py-3 text-sm text-bc-muted"
          onClick={() => void handleAbandon()}
          disabled={stopping || abandoning}
        >
          {abandoning
            ? locale === 'de'
              ? 'Wird abgebrochen …'
              : 'Abandoning …'
            : locale === 'de'
              ? 'Vorgang abbrechen (wenn Stoppen nicht klappt)'
              : 'Abandon session (if stop fails)'}
        </button>
      </div>

      <ChargingDetailsSheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        session={activeSession}
        targetKwh={targetKwh}
        locale={locale}
      />
    </div>
  );
}
