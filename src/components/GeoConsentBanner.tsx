import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getGeoConsent,
  setGeoConsentDenied,
  setGeoConsentGranted,
} from '../utils/geoConsent';
import { useAppStore } from '../store/appStore';

export function GeoConsentBanner() {
  const [visible, setVisible] = useState(() => getGeoConsent() === null);
  const requestLocation = useAppStore((s) => s.requestUserLocation);

  useEffect(() => {
    const onStorage = () => setVisible(getGeoConsent() === null);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!visible) return null;

  const deny = () => {
    setGeoConsentDenied();
    useAppStore.getState().setUserLocation(null);
    setVisible(false);
  };

  const allow = () => {
    setGeoConsentGranted();
    setVisible(false);
    requestLocation();
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[70] mx-auto max-w-lg rounded-2xl border border-bc-border bg-bc-elevated p-4 shadow-card">
      <div className="flex gap-3">
        <MapPin className="h-6 w-6 shrink-0 text-bc-accent" />
        <div>
          <p className="font-medium text-bc-text">Standort für „In der Nähe“</p>
          <p className="mt-1 text-sm text-bc-muted">
            Nur mit Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG) nutzen wir den
            Gerätestandort für Entfernungen – nicht für Werbe-Tracking. Details in der{' '}
            <Link to="/datenschutz" className="text-bc-accent underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary flex-1 text-sm" onClick={allow}>
              Erlauben
            </button>
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={deny}>
              Ablehnen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
