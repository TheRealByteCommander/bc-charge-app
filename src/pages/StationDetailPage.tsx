import {
  Accessibility,
  ArrowLeft,
  Clock,
  Heart,
  Leaf,
  MapPin,
  Navigation,
  Star,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAvailableCount, getStationById } from '../data/stations';
import { useAppStore } from '../store/appStore';
import type { Connector } from '../types';
import { ConnectorPrice } from '../components/ConnectorPrice';

const statusLabel: Record<string, string> = {
  available: 'Verfügbar',
  occupied: 'Belegt',
  offline: 'Offline',
  reserved: 'Reserviert',
};

const statusColor: Record<string, string> = {
  available: 'text-bc-accent',
  occupied: 'text-bc-warn',
  offline: 'text-bc-danger',
  reserved: 'text-bc-blue',
};

export function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const station = getStationById(id ?? '');
  const user = useAppStore((s) => s.user);
  const distance = useAppStore((s) => s.distanceKm);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const startSession = useAppStore((s) => s.startSession);
  const navigate = useNavigate();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState(user?.vehicles[0]?.id ?? '');
  const [selectedPayment, setSelectedPayment] = useState(
    user?.paymentMethods.find((p) => p.isDefault)?.id ?? user?.paymentMethods[0]?.id ?? ''
  );
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

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

  const beginCharge = async () => {
    if (!user) {
      navigate('/anmelden');
      return;
    }
    setStarting(true);
    setError('');
    try {
      if (!selectedConnector) {
        setError('Bitte wählen Sie einen Anschluss.');
        return;
      }
      if (!selectedVehicle && user.vehicles.length) {
        setError('Bitte wählen Sie ein Fahrzeug.');
        return;
      }
      if (!selectedPayment && user.paymentMethods.length) {
        setError('Bitte wählen Sie eine Zahlungsmethode.');
        return;
      }
      if (!user.vehicles.length) {
        setError('Bitte legen Sie zuerst ein Fahrzeug an.');
        navigate('/fahrzeuge');
        return;
      }
      if (!user.paymentMethods.length) {
        setError('Bitte hinterlegen Sie eine Zahlungsmethode.');
        navigate('/zahlung');
        return;
      }
      const res = await startSession(station.id, selectedConnector, selectedVehicle, selectedPayment);
      if (res.ok) navigate('/laden');
      else setError(res.error ?? 'Start fehlgeschlagen');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="page-shell pb-36">
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
          <Star className="inline h-3 w-3 fill-bc-warn text-bc-warn" /> {station.rating} ({station.reviewCount})
        </span>
        <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs text-bc-muted">
          <Clock className="inline h-3 w-3" /> {station.openingHours}
        </span>
        {station.greenEnergy && (
          <span className="rounded-lg bg-bc-accent/15 px-2 py-1 text-xs text-bc-accent">
            <Leaf className="inline h-3 w-3" /> Ökostrom
          </span>
        )}
        {station.accessible && (
          <span className="rounded-lg bg-bc-elevated px-2 py-1 text-xs text-bc-muted">
            <Accessibility className="inline h-3 w-3" /> Barrierefrei
          </span>
        )}
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

      <h2 className="mt-8 font-display font-semibold">Anschlüsse ({getAvailableCount(station)} frei)</h2>
      <div className="mt-3 space-y-3">
        {station.connectors.map((c: Connector) => (
          <button
            key={c.id}
            type="button"
            disabled={c.status !== 'available'}
            onClick={() => setSelectedConnector(c.id)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selectedConnector === c.id
                ? 'border-bc-accent bg-bc-accent/10'
                : 'border-bc-border bg-bc-elevated'
            } ${c.status !== 'available' ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <Zap className="h-4 w-4 text-bc-accent" />
                {c.type} · {c.powerKw} kW
              </span>
              <span className={`text-sm font-medium ${statusColor[c.status]}`}>{statusLabel[c.status]}</span>
            </div>
            <ConnectorPrice connector={c} className="mt-1" />
            <p className="mt-1 font-mono text-xs text-bc-muted">{c.evseId}</p>
          </button>
        ))}
      </div>

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

      <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-lg px-4 safe-bottom">
        <button
          type="button"
          className="btn-primary w-full shadow-glow"
          onClick={beginCharge}
          disabled={starting}
        >
          {starting ? 'Starte Ladevorgang…' : 'Laden starten'}
        </button>
      </div>

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
    </div>
  );
}
