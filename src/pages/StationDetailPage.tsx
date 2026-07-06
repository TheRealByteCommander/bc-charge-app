import { ArrowLeft, Flag, Heart, Info, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChargeStartConfirmSheet } from '../components/ChargeStartConfirmSheet';
import { ChargingSetupChecklist } from '../components/ChargingSetupChecklist';
import { ConnectorLedStatus } from '../components/ConnectorLedStatus';
import { ConnectorPrice } from '../components/ConnectorPrice';
import { GuestBanner } from '../components/GuestBanner';
import { StationInfoSheet } from '../components/sheets/StationInfoSheet';
import { StationReportSheet } from '../components/sheets/StationReportSheet';
import { MenuRow, MenuSection } from '../components/ui/MenuList';
import { getAvailableCount, getStationById } from '../data/stations';
import { computePlugScore } from '../services/community';
import { useAppStore } from '../store/appStore';
import { formatConcurrentSessionError } from '../utils/sessionConcurrency';
import type { Connector } from '../types';
import { isConnectorStartable } from '../utils/ocppStateMapping';
import { buildGuestChargePath } from '../utils/qrDeepLink';

const statusLabel: Record<string, string> = {
  available: 'Verfügbar',
  occupied: 'Angesteckt',
  offline: 'Offline',
  reserved: 'Reserviert',
};

const statusColor: Record<string, string> = {
  available: 'text-bc-accent',
  occupied: 'text-bc-warn',
  offline: 'text-bc-danger',
  reserved: 'text-bc-blue',
};

function formatEvseLabel(connector: { evseNumber?: number; connectorNumber?: number }, index: number): string {
  if (connector.connectorNumber != null) return `Ladepunkt ${connector.connectorNumber}`;
  return `Ladepunkt ${index + 1}`;
}

export function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const station = getStationById(id ?? '');
  const user = useAppStore((s) => s.user);
  const distance = useAppStore((s) => s.distanceKm);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const startSession = useAppStore((s) => s.startSession);
  const activeSession = useAppStore((s) => s.activeSession);
  const setToast = useAppStore((s) => s.setToast);
  const selectedChargingFulfillmentId = useAppStore((s) => s.selectedChargingFulfillmentId);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const citrineosConnected = useAppStore((s) => s.citrineosConnected);
  const navigate = useNavigate();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(searchParams.get('connector'));
  const [selectedVehicle, setSelectedVehicle] = useState(user?.vehicles[0]?.id ?? '');
  const [selectedPayment, setSelectedPayment] = useState(
    user?.paymentMethods.find((p) => p.isDefault)?.id ?? user?.paymentMethods[0]?.id ?? ''
  );
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [startSoc, setStartSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);

  useEffect(() => {
    if (searchParams.get('adhoc') === '1' && station) {
      const connector = searchParams.get('connector') ?? selectedConnector ?? undefined;
      navigate(buildGuestChargePath(station.id, connector ?? undefined), { replace: true });
    }
  }, [searchParams, station, selectedConnector, navigate]);

  useEffect(() => {
    if (!station || selectedConnector) return;
    const startable = station.connectors.filter((c) => isConnectorStartable(c.status, c.ocppRawStatus));
    if (startable.length === 1) setSelectedConnector(startable[0].id);
  }, [station, selectedConnector]);

  if (!station) {
    return (
      <div className="page-shell text-center">
        <p>Station nicht gefunden.</p>
        <Link to="/stationen" className="btn-primary mt-4 inline-block">
          Zurück
        </Link>
      </div>
    );
  }

  const dist = distance(station);
  const isFav = user?.favoriteStationIds.includes(station.id);
  const plugScore = computePlugScore(station.id, station.rating, station.reviewCount);
  const availableCount = getAvailableCount(station);
  const offlineCount = station.connectors.filter((c) => c.status === 'offline').length;
  const liveTrust = citrineosConnected && stationDataSource === 'citrineos';
  const showGreenBadge = stationDataSource !== 'citrineos' ? station.greenEnergy : false;
  const showAccessibleBadge = stationDataSource !== 'citrineos' ? station.accessible : false;
  const selectedConnectorData = station.connectors.find((c) => c.id === selectedConnector);
  const selectedVehicleData = user?.vehicles.find((v) => v.id === selectedVehicle);
  const chargingHere = activeSession?.stationId === station.id;
  const chargingElsewhere = Boolean(activeSession && activeSession.stationId !== station.id);
  const setupIncomplete = Boolean(user && (user.vehicles.length === 0 || user.paymentMethods.length === 0));

  const beginCharge = async () => {
    if (!user) {
      navigate('/anmelden');
      return;
    }
    setStarting(true);
    setError('');
    try {
      if (!selectedConnector) {
        const msg = 'Bitte wählen Sie den Anschluss, an dem Ihr Fahrzeug steckt.';
        setError(msg);
        setToast(msg);
        return;
      }
      if (!user.vehicles.length || !user.paymentMethods.length) {
        const msg = 'Bitte vervollständigen Sie Fahrzeug und Zahlung in Ihrem Profil.';
        setError(msg);
        setToast(msg);
        return;
      }
      const res = await startSession(
        station.id,
        selectedConnector,
        selectedVehicle,
        selectedPayment,
        selectedChargingFulfillmentId
      );
      if (res.ok) {
        setShowConfirm(false);
        navigate('/laden');
      } else {
        const msg = res.error ?? 'Start fehlgeschlagen';
        setError(msg);
        setToast(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Start fehlgeschlagen';
      setError(msg);
      setToast(msg);
    } finally {
      setStarting(false);
    }
  };

  const openConfirm = () => {
    if (!user) {
      navigate('/anmelden');
      return;
    }
    if (!selectedConnector) {
      const msg = 'Bitte wählen Sie zuerst einen Anschluss.';
      setError(msg);
      setToast(msg);
      return;
    }
    setError('');
    setShowConfirm(true);
  };

  return (
    <div className={`page-shell${user ? ' station-detail-with-action' : ''}`}>
      <GuestBanner />

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-bc-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="rounded-full p-2 text-bc-muted hover:bg-bc-elevated"
            aria-label="Stationdetails"
          >
            <Info className="h-5 w-5" />
          </button>
          {user && (
            <button type="button" onClick={() => toggleFavorite(station.id)} className="rounded-full p-2">
              <Heart className={`h-5 w-5 ${isFav ? 'fill-bc-danger text-bc-danger' : 'text-bc-muted'}`} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">{station.name}</h1>
        <p className="mt-1 text-sm text-bc-muted">
          {getAvailableCount(station)} frei
          {dist != null ? ` · ${dist} km` : ''}
        </p>
      </div>

      {user && setupIncomplete && (
        <div className="mt-4">
          <ChargingSetupChecklist user={user} returnTo={`/station/${station.id}`} compact />
        </div>
      )}

      {chargingElsewhere && activeSession && (
        <div className="mt-4 rounded-2xl border border-bc-warn/40 bg-bc-warn/10 p-4 text-sm" role="alert">
          <p className="font-medium">{formatConcurrentSessionError(activeSession)}</p>
          <Link to="/laden" className="btn-secondary mt-3 inline-flex w-full justify-center">
            Zur laufenden Sitzung
          </Link>
        </div>
      )}

      {chargingHere && (
        <Link to="/laden" className="mt-4 block rounded-2xl border border-bc-accent/30 bg-bc-accent/10 p-4 text-center text-sm font-medium text-bc-accent">
          Ladevorgang anzeigen →
        </Link>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-bc-muted">Anschluss wählen</h2>
      <div className="mt-3 space-y-2">
        {station.connectors.map((c: Connector, index: number) => {
          const evseLabel = station.connectors.length > 1 ? formatEvseLabel(c, index) : null;
          const startable = isConnectorStartable(c.status, c.ocppRawStatus);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!startable}
              onClick={() => setSelectedConnector(c.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedConnector === c.id ? 'border-bc-accent bg-bc-accent/10' : 'border-bc-border bg-bc-elevated'
              } ${!startable ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {evseLabel && <p className="text-xs font-medium text-bc-accent">{evseLabel}</p>}
                  <p className="font-semibold">
                    {c.type} · {c.powerKw} kW
                  </p>
                  <ConnectorPrice connector={c} className="mt-0.5 text-sm" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ConnectorLedStatus status={c.status} isH2Hardware={station.hardwareModel === 'CityCharge H2'} />
                  <span className={`text-xs font-medium ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <MenuSection title="Mehr">
        <MenuRow icon={Info} label="Station & Route" onClick={() => setShowInfo(true)} />
        <MenuRow icon={Flag} label="Problem melden" onClick={() => setShowReport(true)} />
      </MenuSection>

      {!user && selectedConnector && (
        <Link
          to={buildGuestChargePath(station.id, selectedConnector)}
          className="btn-primary mt-6 flex w-full items-center justify-center gap-2"
        >
          <Zap className="h-4 w-4" />
          Ad-Hoc laden
        </Link>
      )}

      {user && <div className="h-28 shrink-0" aria-hidden="true" />}

      {user && !showConfirm && !chargingElsewhere && !chargingHere && (
        <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-lg px-4 safe-bottom">
          <button
            type="button"
            className="btn-primary w-full py-4 text-base shadow-glow"
            onClick={openConfirm}
            disabled={starting || !selectedConnector || setupIncomplete}
          >
            Laden starten
          </button>
        </div>
      )}

      {selectedConnectorData && user && (
        <ChargeStartConfirmSheet
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => void beginCharge()}
          station={station}
          connector={selectedConnectorData}
          user={user}
          vehicle={selectedVehicleData}
          selectedVehicleId={selectedVehicle}
          selectedPaymentId={selectedPayment}
          onVehicleChange={setSelectedVehicle}
          onPaymentChange={setSelectedPayment}
          startSoc={startSoc}
          targetSoc={targetSoc}
          onSocChange={(s, t) => {
            setStartSoc(s);
            setTargetSoc(t);
          }}
          confirming={starting}
          error={error}
        />
      )}

      <StationInfoSheet
        open={showInfo}
        onClose={() => setShowInfo(false)}
        station={station}
        distanceKm={dist}
        liveTrust={liveTrust}
        availableCount={availableCount}
        offlineCount={offlineCount}
        plugScore={plugScore}
        showGreenBadge={showGreenBadge}
        showAccessibleBadge={showAccessibleBadge}
      />
      <StationReportSheet open={showReport} onClose={() => setShowReport(false)} stationId={station.id} />
    </div>
  );
}
