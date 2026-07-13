import { Camera, Keyboard, QrCode } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRScanner } from '../components/QRScanner';
import { HelpHintLink } from '../components/help/HelpHintLink';
import { getStationByEvseCode } from '../data/stations';
import { useAppStore } from '../store/appStore';
import { buildGuestChargePath, parseChargeDeepLink } from '../utils/qrDeepLink';

export function ScanPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const lookup = (raw: string) => {
    const deepLink = parseChargeDeepLink(raw);
    if (deepLink) {
      if (deepLink.adhoc) {
        navigate(buildGuestChargePath(deepLink.stationId, deepLink.connectorId));
        return true;
      }
      navigate(
        `/station/${deepLink.stationId}${deepLink.connectorId ? `?connector=${encodeURIComponent(deepLink.connectorId)}` : ''}`
      );
      return true;
    }

    let searchCode = raw.trim().toUpperCase();
    
    if (searchCode.startsWith('HTTP')) {
      try {
        const url = new URL(searchCode.toLowerCase());
        const pathParts = url.pathname.split('/').filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart) searchCode = lastPart.toUpperCase();
      } catch {
        // Not a URL, use as-is
      }
    }
    
    const station = getStationByEvseCode(searchCode);
    if (station) {
      navigate(`/station/${station.id}`);
      return true;
    }
    setError(`Keine Station für „${searchCode}" gefunden.`);
    return false;
  };

  const handleScan = (scannedCode: string) => {
    setShowScanner(false);
    setCode(scannedCode);
    lookup(scannedCode);
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    lookup(code);
  };

  const hasCamera = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

  return (
    <>
      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      <div className="page-shell">
        <h1 className="font-display text-2xl font-bold">Ladepunkt finden</h1>
        <p className="mt-2 text-bc-muted">
          Scannen Sie den QR-Code an der Ladesäule oder geben Sie die Ladepunkt-ID ein.
        </p>

        {hasCamera && (
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-bc-accent/40 bg-bc-accent/5 py-8 text-bc-accent transition hover:border-bc-accent hover:bg-bc-accent/10"
          >
            <QrCode className="h-10 w-10" />
            <div className="text-left">
              <p className="font-semibold">QR-Code scannen</p>
              <p className="text-sm text-bc-muted">Kamera öffnen</p>
            </div>
          </button>
        )}

        {!user && (
          <p className="mt-4 rounded-xl border border-bc-accent/30 bg-bc-accent/10 px-4 py-3 text-sm text-bc-muted">
            Ohne Konto können Sie Ad-Hoc-QR-Codes direkt laden. Für registrierte Nutzer:{' '}
            <Link to="/anmelden" className="font-medium text-bc-accent underline">
              Anmelden
            </Link>
          </p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-bc-border" />
          <span className="text-xs text-bc-muted">oder manuell eingeben</span>
          <div className="h-px flex-1 bg-bc-border" />
        </div>

        <form onSubmit={submitCode} className="mt-6">
          <label htmlFor="evse-code" className="mb-2 flex items-center gap-2 text-sm font-medium text-bc-text">
            <Keyboard className="h-4 w-4 text-bc-muted" aria-hidden />
            Ladepunkt-ID
          </label>
          <input
            id="evse-code"
            className="input-field font-mono uppercase"
            placeholder="z.B. Gruener Weg 3"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            inputMode="text"
          />
          {error && (
            <p className="mt-2 text-sm text-bc-danger" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary mt-4 w-full">
            Station öffnen
          </button>
        </form>

        {!hasCamera && (
          <p className="mt-4 rounded-xl border border-bc-border bg-bc-elevated p-4 text-sm text-bc-muted">
            <Camera className="mb-1 inline h-4 w-4" /> QR-Scanner nicht verfügbar. Bitte geben Sie die
            Ladepunkt-ID manuell ein oder erlauben Sie den Kamerazugriff.
          </p>
        )}

        <div className="mt-8 border-t border-bc-border pt-6 text-center">
          <HelpHintLink hash="#hilfe-qr-scan" />
        </div>
      </div>
    </>
  );
}
