import { Euro, Gauge, Info, Shield } from 'lucide-react';
import { useState } from 'react';
import type { Connector, HardwareFeatures, Vehicle } from '../types';
import { estimateChargeSession } from '../utils/chargeEstimate';
import { formatCurrency } from '../utils/format';

export function ChargePriceEstimate({
  connector,
  vehicle,
  startSoc: controlledStart,
  targetSoc: controlledTarget,
  onSocChange,
  hardwareFeatures,
  compact = false,
}: {
  connector: Connector;
  vehicle?: Vehicle;
  startSoc?: number;
  targetSoc?: number;
  onSocChange?: (start: number, target: number) => void;
  hardwareFeatures?: HardwareFeatures;
  compact?: boolean;
}) {
  const [internalStart, setInternalStart] = useState(30);
  const [internalTarget, setInternalTarget] = useState(80);
  const startSoc = controlledStart ?? internalStart;
  const targetSoc = controlledTarget ?? internalTarget;

  const setStartSoc = (v: number) => {
    if (onSocChange) onSocChange(v, targetSoc);
    else setInternalStart(v);
  };
  const setTargetSoc = (v: number) => {
    if (onSocChange) onSocChange(startSoc, v);
    else setInternalTarget(v);
  };

  const est = estimateChargeSession(connector, vehicle, {
    startSocPercent: startSoc,
    targetSocPercent: targetSoc,
  });

  if (!est.priceKnown) {
    return (
      <div className={compact ? '' : 'mt-4 rounded-2xl border border-bc-border bg-bc-elevated p-4'}>
        <p className="flex items-center gap-2 text-sm text-bc-muted">
          <Info className="h-4 w-4 shrink-0" />
          Aktueller Tarif für diesen Anschluss nicht verfügbar.
        </p>
      </div>
    );
  }

  const sliders = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-bc-muted">Start-SoC %</label>
        <input
          type="range"
          min={5}
          max={90}
          step={5}
          value={startSoc}
          onChange={(e) => {
            const v = Number(e.target.value);
            setStartSoc(v);
            if (v >= targetSoc) setTargetSoc(Math.min(100, v + 10));
          }}
          className="mt-1 w-full accent-bc-accent"
        />
        <p className="text-right text-sm font-medium text-bc-accent">{startSoc}%</p>
      </div>
      <div>
        <label className="text-xs text-bc-muted">Ziel-SoC %</label>
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={targetSoc}
          onChange={(e) => {
            const v = Number(e.target.value);
            setTargetSoc(v);
            if (v <= startSoc) setStartSoc(Math.max(5, v - 10));
          }}
          className="mt-1 w-full accent-bc-accent"
        />
        <p className="text-right text-sm font-medium text-bc-accent">{targetSoc}%</p>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bc-muted">Ladeziel</p>
        {sliders}
        <p className="mt-2 text-xs text-bc-muted">
          ca. {est.kwh} kWh · ~{est.estMinutes} Min.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-bc-accent/30 bg-bc-accent/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bc-accent/20 text-bc-accent">
          <Euro className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-bc-accent">Kostenschätzung</p>
          <p className="mt-1 font-display text-xl font-bold">
            ca. {formatCurrency(est.totalEur)}{' '}
            <span className="text-base font-normal text-bc-muted">für {est.kwh} kWh</span>
          </p>
          <p className="mt-1 text-sm text-bc-muted">
            ~{est.estMinutes} Min. bei {est.effectivePowerKw} kW
            {vehicle ? ` · ${vehicle.nickname}` : ''}
          </p>

          <div className="mt-4">{sliders}</div>

          <p className="mt-3 flex items-start gap-2 text-xs text-bc-muted">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bc-accent" />
            Keine Blockiergebühr – Sie zahlen nur kWh.
          </p>

          {hardwareFeatures?.dynamicLoadManagement && (
            <p className="mt-2 flex items-start gap-2 text-xs text-bc-muted">
              <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bc-warn" />
              Dynamisches Lastmanagement: Ladegeschwindigkeit kann je nach Netzauslastung variieren.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
