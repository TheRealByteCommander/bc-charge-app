import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';
import { ChargePriceEstimate } from './ChargePriceEstimate';
import { ActiveChargingPerkSelect } from './RewardFulfillmentPanel';
import { useAppStore } from '../store/appStore';
import type { Connector, Station, UserProfile, Vehicle } from '../types';
import { estimateChargeSession } from '../utils/chargeEstimate';
import { formatConnectorPriceSummary } from '../utils/pricing';
import { formatCurrency } from '../utils/format';

function formatEvseDisplay(connector: Connector): string | null {
  if (connector.evseNumber != null) {
    return `Ladepunkt ${connector.evseNumber}`;
  }
  return null;
}

export function ChargeStartConfirmSheet({
  open,
  onClose,
  onConfirm,
  station,
  connector,
  user,
  vehicle,
  selectedVehicleId,
  selectedPaymentId,
  onVehicleChange,
  onPaymentChange,
  startSoc,
  targetSoc,
  onSocChange,
  confirming,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  station: Station;
  connector: Connector;
  user: UserProfile;
  vehicle?: Vehicle;
  selectedVehicleId: string;
  selectedPaymentId: string;
  onVehicleChange: (id: string) => void;
  onPaymentChange: (id: string) => void;
  startSoc: number;
  targetSoc: number;
  onSocChange: (start: number, target: number) => void;
  confirming?: boolean;
  error?: string;
}) {
  const est = estimateChargeSession(connector, vehicle, {
    startSocPercent: startSoc,
    targetSocPercent: targetSoc,
  });
  const rewardFulfillments = useAppStore((s) => s.rewardFulfillments);
  const selectedChargingFulfillmentId = useAppStore((s) => s.selectedChargingFulfillmentId);
  const setSelectedChargingFulfillment = useAppStore((s) => s.setSelectedChargingFulfillment);

  const actionButtons = (
    <div className="flex gap-3">
      <button type="button" className="btn-secondary flex-1 py-3" onClick={onClose} disabled={confirming}>
        Abbrechen
      </button>
      <button
        type="button"
        className="btn-primary flex flex-1 items-center justify-center gap-2 py-3"
        onClick={onConfirm}
        disabled={confirming}
      >
        <Check className="h-4 w-4" />
        {confirming ? 'Starte…' : 'Jetzt laden'}
      </button>
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Laden starten" footer={actionButtons}>
      <div className="space-y-4">
        {error ? (
          <div className="space-y-2" role="alert">
            <p className="rounded-xl border border-bc-danger/40 bg-bc-danger/10 px-3 py-2 text-sm text-bc-danger">
              {error}
            </p>
            {error.includes('laden bereits') ? (
              <Link
                to="/laden"
                onClick={onClose}
                className="btn-secondary flex w-full justify-center py-2.5 text-sm"
              >
                Zur laufenden Sitzung
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-bc-border bg-bc-surface p-4 text-sm">
          <p className="font-medium text-bc-text">{station.name}</p>
          {formatEvseDisplay(connector) && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-bc-accent">
              {formatEvseDisplay(connector)}
            </p>
          )}
          <div className="mt-3 flex justify-between gap-2">
            <span className="text-bc-muted">Anschluss</span>
            <span className="font-medium">
              {connector.type} · {connector.powerKw} kW
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-bc-muted">Tarif</span>
            <span className="text-right">{formatConnectorPriceSummary(connector)}</span>
          </div>
          {est.priceKnown && (
            <div className="mt-3 flex justify-between gap-2 border-t border-bc-border pt-3">
              <span className="font-medium">Voraussichtlich ca.</span>
              <span className="font-display text-lg font-bold text-bc-accent">
                {formatCurrency(est.totalEur)}
              </span>
            </div>
          )}
        </div>

        {user.vehicles.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-bc-muted">
              Fahrzeug
            </label>
            <select
              className="input-field"
              value={selectedVehicleId}
              onChange={(e) => onVehicleChange(e.target.value)}
            >
              {user.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname} – {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>
        )}

        {user.paymentMethods.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-bc-muted">
              Zahlung
            </label>
            <select
              className="input-field"
              value={selectedPaymentId}
              onChange={(e) => onPaymentChange(e.target.value)}
            >
              {user.paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.last4 ? `•••• ${p.last4}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <ChargePriceEstimate
          connector={connector}
          vehicle={vehicle}
          startSoc={startSoc}
          targetSoc={targetSoc}
          onSocChange={onSocChange}
          hardwareFeatures={station.hardwareFeatures}
          compact
        />

        <ActiveChargingPerkSelect
          fulfillments={rewardFulfillments}
          selectedId={selectedChargingFulfillmentId}
          onChange={setSelectedChargingFulfillment}
        />

        <p className="text-xs text-bc-muted">
          Die Endabrechnung richtet sich nach der tatsächlich geladenen Energie.
        </p>
      </div>
    </BottomSheet>
  );
}
