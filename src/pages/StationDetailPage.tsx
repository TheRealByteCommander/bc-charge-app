import {
  Accessibility,
  ArrowLeft,
  Clock,
  Gauge,
  Heart,
  Leaf,
  MapPin,
  Navigation,
  Scale,
  Star,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChargingSetupChecklist } from '../components/ChargingSetupChecklist';
import { ChargePriceEstimate } from '../components/ChargePriceEstimate';
import { ChargeStartConfirmSheet } from '../components/ChargeStartConfirmSheet';
import { CommunityReportForm } from '../components/CommunityReportForm';
import { ConnectorLedStatus } from '../components/ConnectorLedStatus';
import { ConnectorPrice } from '../components/ConnectorPrice';
import { GuestBanner } from '../components/GuestBanner';
import { StationTrustBadge } from '../components/StationTrustBadge';
import { getAvailableCount, getStationById } from '../data/stations';
import { computePlugScore } from '../services/community';
import { useAppStore } from '../store/appStore';
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

/** Prüft ob Station Multi-Connector-Support hat (z.B. H2 mit 2 Ladepunkten) */
function isMultiConnectorStation(station: ReturnType<typeof getStationById>): boolean {
  if (!station) return false;
  return station.connectors.length > 1 || station.hardwareFeatures?.multiConnector === true;
}

/** Formatiert Ladepunkt-Anzeige - nutzt connectorNumber für die Nummerierung */
function formatEvseLabel(connector: { evseNumber?: number; connectorNumber?: number }, index: number): string {
  if (connector.connectorNumber != null) {
    return `Ladepunkt ${connector.connectorNumber}`;
  }
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
  const setToast = useAppStore((s) => s.setToast);
  const selectedChargingFulfillmentId = useAppStore((s) => s.selectedChargingFulfillmentId);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const citrineosConnected = useAppStore((s) => s.citrineosConnected);
  const navigate = useNavigate();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(
    searchParams.get('connector')
  );
  const [selectedVehicle, setSelectedVehicle] = useState(user?.vehicles[0]?.id ?? '');
  const [selectedPayment, setSelectedPayment] = useState(
    user?.paymentMethods.find((p) => p.isDefault)?.id ?? user?.paymentMethods[0]?.id ?? ''
  );
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
    if (startable.length === 1) {
      setSelectedConnector(startable[0].id);
    }
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
      if (!selectedVehicle && user.vehicles.length) {
        const msg = 'Bitte wählen Sie ein Fahrzeug.';
        setError(msg);
        setToast(msg);
        return;
      }
      if (!selectedPayment && user.paymentMethods.length) {
        const msg = 'Bitte wählen Sie eine Zahlungsmethode.';
        setError(msg);
        setToast(msg);
        return;
      }
      if (!user.vehicles.length) {
        const msg = 'Bitte legen Sie zuerst ein Fahrzeug an (siehe Checkliste oben).';
        setError(msg);
        setToast(msg);
        return;
      }
      if (!user.paymentMethods.length) {
        const msg = 'Bitte hinterlegen Sie eine Zahlungsmethode (siehe Checkliste oben).';
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
      const msg = 'Bitte wählen Sie zuerst den Anschluss, an dem Ihr Fahrzeug steckt.';
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
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-bc-muted"
      >
        <ArrowLeft className="h-5 w-5" />
        Zurück
      </button>
      <div className={`mt-4 h-32 rounded-2xl bg-gradient-to-br ${station.imageGradient}`} />
      <div className="mt-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-bc-accent">{station.evseCode}</p>
          <h1 className="font-display text-xl font-bold">{station.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-bc-muted">
            <MapPin className="h-4 w-4" />
            {station.address}, {station.zip} {station.city}
            {dist != null && ` · ${dist} km`}
          </p>
        </div>
        {user && (
          <button type="button" onClick={() => toggleFavorite(station.id)} className="rounded-full p-2">
            <Heart className={`h-6 w-6 ${isFav ? 'fill-bc-danger text-bc-danger' : 'text-bc-muted'}`} />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs">
          <Star className="inline h-3 w-3 fill-bc-warn text-bc-warn" /> PlugScore {plugScore}
        </span>
        <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs text-bc-muted">
          <Clock className="inline h-3 w-3" /> {station.openingHours}
        </span>
        {showGreenBadge && (
          <span className="rounded-lg bg-bc-accent/15 px-2 py-1 text-xs text-bc-accent">
            <Leaf className="inline h-3 w-3" /> Ökostrom
          </span>
        )}
        {showAccessibleBadge && (
          <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs text-bc-muted">
            <Accessibility className="inline h-3 w-3" /> Barrierefrei
          </span>
        )}
        {station.hardwareFeatures?.midCertifiedMeters && (
          <span className="rounded-lg bg-bc-blue/15 px-2 py-1 text-xs text-bc-blue">
            <Scale className="inline h-3 w-3" /> Eichrecht
          </span>
        )}
        {station.hardwareFeatures?.dynamicLoadManagement && (
          <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs text-bc-muted">
            <Gauge className="inline h-3 w-3" /> Lastmanagement
          </span>
        )}
      </div>

      <div className="mt-4">
        <StationTrustBadge
          stationId={station.id}
          liveData={liveTrust}
          availableCount={availableCount}
          offlineCount={offlineCount}
        />
      </div>

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary mt-4 flex w-full items-center justify-center gap-2"
      >
        <Navigation className="h-4 w-4" />
        Route planen
      </a>

      {user && <ChargingSetupChecklist user={user} returnTo={`/station/${station.id}`} />}

      <h2 className="mt-8 font-display font-semibold">
        {isMultiConnectorStation(station) ? 'Ladepunkt wählen' : 'Anschlüsse'} ({getAvailableCount(station)} frei)
      </h2>
      {isMultiConnectorStation(station) && (
        <p className="mt-1 text-sm text-bc-muted">
          Diese Station hat mehrere Ladepunkte. Bitte wählen Sie den Anschluss, an dem Ihr Fahrzeug steht.
        </p>
      )}
      <div className="mt-3 space-y-3">
        {station.connectors.map((c: Connector, index: number) => {
          const evseLabel = formatEvseLabel(c, index);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!isConnectorStartable(c.status, c.ocppRawStatus)}
              onClick={() => setSelectedConnector(c.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedConnector === c.id
                  ? 'border-bc-accent bg-bc-accent/10'
                  : 'border-bc-border bg-bc-elevated'
              } ${!isConnectorStartable(c.status, c.ocppRawStatus) ? 'opacity-50' : ''}`}
            >
              {evseLabel && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bc-accent">
                  {evseLabel}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4 text-bc-accent" />
                  {c.type} · {c.powerKw} kW
                </span>
                <div className="flex items-center gap-3">
                  <ConnectorLedStatus
                    status={c.status}
                    isH2Hardware={station.hardwareModel === 'CityCharge H2'}
                  />
                  <span className={`text-sm font-medium ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
                </div>
              </div>
              <ConnectorPrice connector={c} className="mt-1" />
              <p className="mt-1 font-mono text-xs text-bc-muted">{c.evseId}</p>
            </button>
          );
        })}
      </div>

      {selectedConnectorData && (
        <ChargePriceEstimate
          connector={selectedConnectorData}
          vehicle={selectedVehicleData}
          startSoc={startSoc}
          targetSoc={targetSoc}
          onSocChange={(s, t) => {
            setStartSoc(s);
            setTargetSoc(t);
          }}
          hardwareFeatures={station.hardwareFeatures}
        />
      )}

      {user && user.vehicles.length > 0 && (
        <>
          <h2 className="mt-6 font-display font-semibold">Fahrzeug</h2>
          <select
            className="input-field mt-2"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
          >
            {user.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nickname} – {v.brand} {v.model}
              </option>
            ))}
          </select>
        </>
      )}

      {user && user.paymentMethods.length > 0 && (
        <>
          <h2 className="mt-4 font-display font-semibold">Zahlung</h2>
          <select
            className="input-field mt-2"
            value={selectedPayment}
            onChange={(e) => setSelectedPayment(e.target.value)}
          >
            {user.paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.last4 ? `•••• ${p.last4}` : ''}
              </option>
            ))}
          </select>
        </>
      )}

      {error && <p className="mt-4 text-sm text-bc-danger">{error}</p>}

      {!user && selectedConnector && (
        <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-accent/5 p-4">
          <p className="text-sm text-bc-muted">
            Laden ohne Konto – per Karte bezahlen und sofort starten.
          </p>
          <Link
            to={buildGuestChargePath(station.id, selectedConnector)}
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Ad-Hoc laden
          </Link>
        </div>
      )}

      {station.amenities.length > 0 && (
        <>
          <h2 className="mt-8 font-display font-semibold">Am Standort</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {station.amenities.map((a) => (
              <span key={a} className="rounded-lg border border-bc-border px-3 py-1 text-sm text-bc-muted">
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      <CommunityReportForm stationId={station.id} />

      {user && <div className="h-28 shrink-0" aria-hidden="true" />}

      {user && !showConfirm && (
        <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-lg px-4 safe-bottom">
          <button
            type="button"
            className="btn-primary w-full shadow-glow"
            onClick={openConfirm}
            disabled={
              starting ||
              !selectedConnector ||
              user.vehicles.length === 0 ||
              user.paymentMethods.length === 0
            }
          >
            Laden starten
          </button>
        </div>
      )}

      {selectedConnectorData && (
        <ChargeStartConfirmSheet
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={() => void beginCharge()}
          station={station}
          connector={selectedConnectorData}
          vehicle={selectedVehicleData}
          startSoc={startSoc}
          targetSoc={targetSoc}
          confirming={starting}
          error={error}
        />
      )}

    </div>
  );
}
