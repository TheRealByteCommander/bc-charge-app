import { Leaf, MapPin, Navigation, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChargeMap } from '../components/ChargeMap';
import { useLocale } from '../i18n/LocaleContext';
import { getStations } from '../data/stations';
import {
  geocodeDestination,
  mapsDirectionsUrl,
  mapsDirectionsWithWaypoints,
  planTrip,
  type RoutePreference,
} from '../services/tripPlanner';
import { getGeoConsent, setGeoConsentGranted } from '../utils/geoConsent';
import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../utils/format';

const PREFS: { id: RoutePreference; de: string; en: string }[] = [
  { id: 'balanced', de: 'Ausgewogen', en: 'Balanced' },
  { id: 'fast', de: 'Schnell laden', en: 'Fast charge' },
  { id: 'cheap', de: 'Günstig', en: 'Low cost' },
  { id: 'green', de: 'Ökostrom', en: 'Green energy' },
];

export function TripPage() {
  const { locale, t } = useLocale();
  const user = useAppStore((s) => s.user);
  const userLocation = useAppStore((s) => s.userLocation);
  const requestUserLocation = useAppStore((s) => s.requestUserLocation);
  const vehicle = user?.vehicles[0];

  const [destination, setDestination] = useState('');
  const [startSoc, setStartSoc] = useState(80);
  const [arrivalSoc, setArrivalSoc] = useState(15);
  const [preference, setPreference] = useState<RoutePreference>('balanced');

  const plan = useMemo(() => {
    if (!userLocation || !vehicle || !destination.trim()) return null;
    const to = geocodeDestination(destination);
    if (!to) return null;
    return planTrip({
      from: userLocation,
      toLabel: destination,
      to,
      vehicle,
      startSocPercent: startSoc,
      arrivalSocPercent: arrivalSoc,
      preference,
    });
  }, [userLocation, vehicle, destination, startSoc, arrivalSoc, preference]);

  const toCoords = destination.trim() ? geocodeDestination(destination) : null;

  const chargeWaypoints = useMemo(
    () =>
      plan?.legs
        .filter((l) => l.kind === 'charge' && l.lat != null && l.lng != null)
        .map((l) => ({ lat: l.lat!, lng: l.lng! })) ?? [],
    [plan]
  );

  return (
    <div className="page-shell pb-8">
      <h1 className="font-display text-2xl font-bold">{t.trip.title}</h1>
      <p className="mt-2 text-sm text-bc-muted leading-relaxed">
        {locale === 'de'
          ? 'Routenplanung mit Lade-Stopps entlang der Strecke. Städte: Berlin, Leipzig, München, Hamburg, Dresden, Frankfurt, Köln.'
          : 'Route planning with charging stops along the way. Cities: Berlin, Leipzig, Munich, Hamburg, Dresden, Frankfurt, Cologne.'}
      </p>

      {!userLocation && getGeoConsent() !== 'denied' && (
        <button
          type="button"
          className="btn-secondary mt-4 w-full"
          onClick={() => {
            if (getGeoConsent() === null) setGeoConsentGranted();
            requestUserLocation();
          }}
        >
          <MapPin className="inline h-4 w-4" />{' '}
          {locale === 'de' ? 'Standort für Route erlauben' : 'Allow location for route'}
        </button>
      )}
      {getGeoConsent() === 'denied' && !userLocation && (
        <p className="mt-2 text-sm text-bc-muted">
          {locale === 'de' ? (
            <>
              Standort wurde abgelehnt.{' '}
              <Link to="/profil" className="text-bc-accent">
                Im Profil widerrufen/ändern
              </Link>
            </>
          ) : (
            <>
              Location denied.{' '}
              <Link to="/profil" className="text-bc-accent">
                Change in profile
              </Link>
            </>
          )}
        </p>
      )}

      {!vehicle && (
        <p className="mt-4 text-sm text-bc-warn">
          <Link to="/fahrzeuge" className="text-bc-accent underline">
            {locale === 'de' ? 'Fahrzeug anlegen' : 'Add a vehicle'}
          </Link>{' '}
          {locale === 'de' ? 'für Verbrauch und Ladeleistung.' : 'for consumption and charge power.'}
        </p>
      )}

      <input
        className="input-field mt-4"
        placeholder={t.trip.destination}
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-bc-muted">{locale === 'de' ? 'Start-SoC %' : 'Start SoC %'}</label>
          <input
            type="number"
            min={10}
            max={100}
            className="input-field mt-1"
            value={startSoc}
            onChange={(e) => setStartSoc(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-bc-muted">{locale === 'de' ? 'Ziel-SoC %' : 'Arrival SoC %'}</label>
          <input
            type="number"
            min={5}
            max={50}
            className="input-field mt-1"
            value={arrivalSoc}
            onChange={(e) => setArrivalSoc(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PREFS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreference(p.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              preference === p.id ? 'bg-bc-accent text-bc-ink' : 'bg-bc-surface text-bc-muted'
            }`}
          >
            {locale === 'de' ? p.de : p.en}
          </button>
        ))}
      </div>

      {plan && userLocation && (
        <div className="mt-6">
          <h2 className="font-display font-semibold">
            {locale === 'de' ? 'Route auf der Karte' : 'Route on map'}
          </h2>
          <div className="mt-3">
            <ChargeMap
              stations={getStations()}
              center={[userLocation.lat, userLocation.lng]}
              zoom={8}
              height="220px"
              highlightStationIds={plan.chargeStationIds}
              routeLine={plan.routeLine}
            />
          </div>
        </div>
      )}

      {plan && (
        <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-accent/5 p-4">
          <p className="text-sm text-bc-muted">
            {plan.totalDistanceKm} km · ~{formatCurrency(plan.estTotalCostEur)}{' '}
            {locale === 'de' ? 'Ladekosten' : 'charging'} · {plan.estCo2SavedKg} kg CO₂
          </p>
          <h2 className="mt-4 font-display font-semibold">{t.trip.stops}</h2>
          <ol className="mt-2 space-y-3">
            {plan.legs.map((leg, i) => (
              <li key={i} className="rounded-xl border border-bc-border bg-bc-elevated p-3 text-sm">
                {leg.kind === 'charge' ? (
                  <>
                    <span className="flex items-center gap-1 font-medium text-bc-accent">
                      <Zap className="h-4 w-4" /> {leg.label}
                    </span>
                    {leg.station && (
                      <Link to={`/station/${leg.station.id}`} className="mt-1 block text-bc-accent underline">
                        {locale === 'de' ? 'Station öffnen' : 'Open station'}
                      </Link>
                    )}
                    {leg.estKwh != null && (
                      <p className="mt-1 text-bc-muted">
                        ~{leg.estKwh} kWh · ~{leg.estMinutes} min
                      </p>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-1 font-medium">
                    <Navigation className="h-4 w-4" />{' '}
                    {locale === 'de' ? 'Fahrt' : 'Drive'} · {leg.label} ({leg.distanceKm} km)
                  </span>
                )}
              </li>
            ))}
          </ol>
          {userLocation && toCoords && (
            <a
              href={
                chargeWaypoints.length > 0
                  ? mapsDirectionsWithWaypoints(userLocation, toCoords, chargeWaypoints)
                  : mapsDirectionsUrl(userLocation, toCoords)
              }
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-4 flex w-full items-center justify-center gap-2"
            >
              <Navigation className="h-4 w-4" />
              {t.trip.openMaps}
            </a>
          )}
        </div>
      )}

      {destination && !plan && vehicle && userLocation && (
        <p className="mt-4 text-sm text-bc-warn">
          {locale === 'de' ? 'Ziel nicht erkannt oder Strecke zu kurz.' : 'Destination unknown or trip too short.'}
        </p>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-bc-muted">
        <Leaf className="h-4 w-4 shrink-0 text-bc-accent" />
        {locale === 'de'
          ? 'Die Route berücksichtigt Ihr Fahrzeug und schlägt Ladestopps entlang der Strecke vor.'
          : 'The route uses your vehicle profile and suggests charging stops along the way.'}
      </p>
    </div>
  );
}
