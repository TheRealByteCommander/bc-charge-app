import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Gauge, Scale, Shield, Square, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ChargingEmergencyHelp } from '../components/ChargingEmergencyHelp';
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
  const stopSession = useAppStore((s) => s.stopSession);
  const navigate = useNavigate();
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(Date.now());

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
        <p className="mt-2 text-bc-muted">
          {locale === 'de' ? 'Wählen Sie eine Station und starten Sie das Laden.' : 'Select a station and start charging.'}
        </p>
        <Link to="/scan" className="btn-primary mt-8">
          {locale === 'de' ? 'Ladepunkt-ID eingeben' : 'Enter charging point ID'}
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
  const socPercent = vehicle
    ? Math.min(100, Math.round((activeSession.energyKwh / vehicle.batteryKwh) * 100))
    : null;
  
  const hasMidMeters = station?.hardwareFeatures?.midCertifiedMeters ?? false;
  const hasDynamicLoad = station?.hardwareFeatures?.dynamicLoadManagement ?? false;
  const evseNumber = activeSession.evseNumber;
  const chargingStateInfo = getChargingStateInfo(activeSession.chargingState);

  const handleStop = async () => {
    setStopping(true);
    await stopSession();
    setStopping(false);
    navigate('/historie');
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-28 pt-8">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-bc-accent">
        {t.charging.active}
      </p>
      <h1 className="mt-2 text-center font-display text-lg font-semibold leading-snug">
        {activeSession.stationName}
      </h1>
      <p className="text-center text-sm text-bc-muted">
        {evseNumber != null && <span className="font-medium text-bc-accent">{locale === 'de' ? 'Ladepunkt' : 'Charging point'} {evseNumber} · </span>}
        {activeSession.connectorType} · {formatPower(activeSession.powerKw)}
      </p>
      {station?.hardwareModel === 'CityCharge H2' && (
        <div className="mt-2 flex justify-center">
          <ConnectorLedStatus status="occupied" isH2Hardware className="text-sm" />
        </div>
      )}
      {(hasMidMeters || hasDynamicLoad) && (
        <div className="mt-2 flex justify-center gap-2">
          {hasMidMeters && (
            <span className="flex items-center gap-1 rounded-full bg-bc-blue/10 px-2 py-0.5 text-xs text-bc-blue">
              <Scale className="h-3 w-3" /> {t.charging.eichrecht}
            </span>
          )}
          {hasDynamicLoad && (
            <span className="flex items-center gap-1 rounded-full bg-bc-elevated px-2 py-0.5 text-xs text-bc-muted">
              <Gauge className="h-3 w-3" /> {t.charging.loadManagement}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-xs text-bc-muted">{t.charging.chargingPower}</p>
          <p className="font-display text-2xl font-bold text-bc-accent">{formatPower(activeSession.powerKw)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-bc-muted">{t.charging.estimatedTime}</p>
          <p className="font-display text-2xl font-bold">
            {remainingMin == null ? '—' : remainingMin <= 0 ? (locale === 'de' ? 'Fertig' : 'Done') : `~${remainingMin} ${locale === 'de' ? 'Min.' : 'min'}`}
          </p>
        </div>
      </div>

      {chargingStateInfo.isPaused && (
        <div className="mx-auto mt-4 max-w-xs rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-center">
          <p className="text-sm font-medium text-bc-warn">{chargingStateInfo.label}</p>
          <p className="mt-1 text-xs text-bc-muted">{chargingStateInfo.description}</p>
        </div>
      )}

      <div className="relative mx-auto mt-8 flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#243040" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={chargingStateInfo.isPaused ? 'url(#grad-paused)' : 'url(#grad)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.76} 276`}
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2ee59d" />
              <stop offset="100%" stopColor="#5dffb8" />
            </linearGradient>
            <linearGradient id="grad-paused" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
        <motion.div
          animate={{ scale: chargingStateInfo.isPaused ? [1, 1, 1] : [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-center"
        >
          <p className="font-display text-4xl font-bold text-bc-text">{formatKwh(activeSession.energyKwh)}</p>
          <p className="text-sm text-bc-muted">{formatDuration(elapsed)}</p>
          {socPercent != null && vehicle && (
            <p className="mt-1 text-xs text-bc-accent">~{socPercent}% von {vehicle.batteryKwh} kWh</p>
          )}
        </motion.div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
          <p className="text-xs text-bc-muted">{t.charging.cost}</p>
          <p className="mt-1 font-display text-xl font-bold">{formatCurrency(activeSession.costEur)}</p>
        </div>
        <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
          <p className="text-xs text-bc-muted">BC {t.gamification.points}</p>
          <p className="mt-1 font-display text-xl font-bold text-bc-accent">+{activeSession.pointsEarned}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
        <div className="flex justify-between text-sm">
          <span className="text-bc-muted">{locale === 'de' ? 'Ziel' : 'Target'}</span>
          <span>{formatKwh(targetKwh)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-bc-muted">{t.charging.pricePerKwh}</span>
          <span>{formatCurrency(activeSession.pricePerKwh)}/kWh</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-bc-muted">{t.charging.startPrice}</span>
          <span>{formatCurrency(activeSession.sessionFee)}</span>
        </div>
        <p className="mt-3 flex items-center gap-2 border-t border-bc-border pt-3 text-xs text-bc-accent">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          {locale === 'de' ? 'Keine Blockiergebühr bei BC Charge' : 'No idle fee at BC Charge'}
        </p>
      </div>

      <ChargingEmergencyHelp session={activeSession} />

      <div className="mt-8">
        <button
          type="button"
          className="btn-primary flex w-full items-center justify-center gap-2 bg-bc-danger from-bc-danger to-red-600"
          onClick={handleStop}
          disabled={stopping}
        >
          <Square className="h-4 w-4" />
          {stopping ? t.common.loading : t.charging.stop}
        </button>
      </div>
    </div>
  );
}