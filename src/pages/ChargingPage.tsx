import { motion } from 'framer-motion';
import { useState } from 'react';
import { Pause, Square, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDuration, formatKwh, formatPower } from '../utils/format';

export function ChargingPage() {
  const activeSession = useAppStore((s) => s.activeSession);
  const stopSession = useAppStore((s) => s.stopSession);
  const navigate = useNavigate();
  const [stopping, setStopping] = useState(false);

  if (!activeSession) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28 text-center">
        <Zap className="h-16 w-16 text-bc-muted opacity-40" />
        <h1 className="mt-6 font-display text-xl font-bold">Kein aktiver Ladevorgang</h1>
        <p className="mt-2 text-bc-muted">Wählen Sie eine Station und starten Sie das Laden.</p>
        <Link to="/stationen" className="btn-primary mt-8">
          Station finden
        </Link>
      </div>
    );
  }

  const elapsed = Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000);
  const progress = Math.min(100, (activeSession.energyKwh / 60) * 100);

  const handleStop = async () => {
    setStopping(true);
    await stopSession();
    setStopping(false);
    navigate('/historie');
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-28 pt-8">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-bc-accent">
        Ladevorgang aktiv
      </p>
      <h1 className="mt-2 text-center font-display text-lg font-semibold leading-snug">
        {activeSession.stationName}
      </h1>
      <p className="text-center text-sm text-bc-muted">
        {activeSession.connectorType} · {formatPower(activeSession.powerKw)}
      </p>

      <div className="relative mx-auto mt-10 flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#243040" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#grad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.76} 276`}
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2ee59d" />
              <stop offset="100%" stopColor="#5dffb8" />
            </linearGradient>
          </defs>
        </svg>
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-center"
        >
          <p className="font-display text-4xl font-bold text-bc-text">{formatKwh(activeSession.energyKwh)}</p>
          <p className="text-sm text-bc-muted">{formatDuration(elapsed)}</p>
        </motion.div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
          <p className="text-xs text-bc-muted">Kosten</p>
          <p className="mt-1 font-display text-xl font-bold">{formatCurrency(activeSession.costEur)}</p>
        </div>
        <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
          <p className="text-xs text-bc-muted">BC Points</p>
          <p className="mt-1 font-display text-xl font-bold text-bc-accent">+{activeSession.pointsEarned}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
        <div className="flex justify-between text-sm">
          <span className="text-bc-muted">Leistung</span>
          <span>{formatPower(activeSession.powerKw)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-bc-muted">Preis</span>
          <span>{formatCurrency(activeSession.pricePerKwh)}/kWh</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-bc-muted">Startgebühr</span>
          <span>{formatCurrency(activeSession.sessionFee)}</span>
        </div>
      </div>

      <div className="mt-auto flex gap-3 pt-8">
        <button type="button" className="btn-secondary flex-1" disabled>
          <Pause className="h-4 w-4" />
          Pause
        </button>
        <button
          type="button"
          className="btn-primary flex-1 bg-bc-danger from-bc-danger to-red-600"
          onClick={handleStop}
          disabled={stopping}
        >
          <Square className="h-4 w-4" />
          {stopping ? 'Beende…' : 'Beenden'}
        </button>
      </div>
    </div>
  );
}
