import { Check, Gauge, Scale, Shield } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { ActiveChargingPerkSelect } from './RewardFulfillmentPanel';
import { useAppStore } from '../store/appStore';
import type { Connector, Station, Vehicle } from '../types';
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
  vehicle,
  startSoc,
  targetSoc,
  confirming,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  station: Station;
  connector: Connector;
  vehicle?: Vehicle;
  startSoc: number;
  targetSoc: number;
  confirming?: boolean;
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
    <BottomSheet open={open} onClose={onClose} title="Preis bestätigen" footer={actionButtons}>
      <div className="space-y-4">
        <p className="text-sm text-bc-muted">
          Bitte prüfen Sie den Tarif für <span className="font-medium text-bc-text">{station.name}</span> vor
          dem Start.
        </p>

        <div className="rounded-xl border border-bc-border bg-bc-surface p-4 text-sm">
          {formatEvseDisplay(connector) && (
            <div className="mb-3 flex items-center gap-2 border-b border-bc-border pb-3">
              <span className="font-semibold text-bc-accent">{formatEvseDisplay(connector)}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
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
            <>
              <div className="mt-2 flex justify-between gap-2">
                <span className="text-bc-muted">Schätzung ({startSoc}→{targetSoc}%)</span>
                <span>{est.kwh} kWh</span>
              </div>
              <div className="mt-3 flex justify-between gap-2 border-t border-bc-border pt-3">
                <span className="font-medium">Voraussichtlich ca.</span>
                <span className="font-display text-lg font-bold text-bc-accent">
                  {formatCurrency(est.totalEur)}
                </span>
              </div>
            </>
          )}
        </div>

        <ActiveChargingPerkSelect
          fulfillments={rewardFulfillments}
          selectedId={selectedChargingFulfillmentId}
          onChange={setSelectedChargingFulfillment}
        />

        <div className="flex items-start gap-3 rounded-xl border border-bc-accent/25 bg-bc-accent/5 p-3 text-sm">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-bc-accent" />
          <div>
            <p className="font-medium text-bc-text">Keine Blockiergebühr</p>
            <p className="mt-1 text-bc-muted">
              BC Charge erhebt keine Blockier- oder Standgebühren nach dem Laden. Sie zahlen nur für
              verbrauchte kWh.
            </p>
          </div>
        </div>

        {station.hardwareFeatures?.midCertifiedMeters && (
          <div className="flex items-start gap-3 rounded-xl border border-bc-blue/25 bg-bc-blue/5 p-3 text-sm">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-bc-blue" />
            <div>
              <p className="font-medium text-bc-text">Eichrecht-konforme Messung</p>
              <p className="mt-1 text-bc-muted">
                Diese Station nutzt MID-zertifizierte Zähler. Die Abrechnung erfolgt nach deutschem Eichrecht.
              </p>
            </div>
          </div>
        )}

        {station.hardwareFeatures?.dynamicLoadManagement && (
          <div className="flex items-start gap-3 rounded-xl border border-bc-border bg-bc-elevated p-3 text-sm">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-bc-muted" />
            <div>
              <p className="font-medium text-bc-text">Dynamisches Lastmanagement</p>
              <p className="mt-1 text-bc-muted">
                Die Ladeleistung kann je nach Netzauslastung automatisch angepasst werden.
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-bc-muted">
          Die Endabrechnung richtet sich nach der tatsächlich geladenen Energie. Sie erhalten sofort nach dem
          Laden eine Rechnung per E-Mail.
        </p>
      </div>
    </BottomSheet>
  );
}
