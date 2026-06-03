import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const CONSENT_KEY = 'bc_geo_consent';

export function getGeoConsent(): 'granted' | 'denied' | null {
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === '1') return 'granted';
  if (v === '0') return 'denied';
  return null;
}

export function GeoConsentBanner() {
  const [visible, setVisible] = useState(() => getGeoConsent() === null);
  const requestLocation = useAppStore((s) => s.requestUserLocation);

  if (!visible) return null;

  const deny = () => {
    localStorage.setItem(CONSENT_KEY, '0');
    setVisible(false);
  };

  const allow = () => {
    localStorage.setItem(CONSENT_KEY, '1');
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
            Wir nutzen Ihren ungefähren Standort nur zur Entfernungsanzeige auf dem Gerät. Details in
            der{' '}
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
