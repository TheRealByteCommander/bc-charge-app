import { Info, Keyboard } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStationByEvseCode } from '../data/stations';
import { useAppStore } from '../store/appStore';

export function ScanPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  const lookup = (raw: string) => {
    const station = getStationByEvseCode(raw);
    if (station) {
      navigate(`/station/${station.id}`);
      return true;
    }
    setError(`Keine Station für „${raw.toUpperCase()}“ gefunden.`);
    return false;
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    lookup(code.trim());
  };

  const quickCodes = ['BC-MAC-001', 'BC-LEI-002', 'BC-LEI-006'];

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Ladepunkt finden</h1>
      <p className="mt-2 text-bc-muted">
        Geben Sie die Ladepunkt-ID von der Säule ein – sie steht unter dem QR-Code (z. B. BC-MAC-001).
      </p>

      <div className="mt-4 flex gap-3 rounded-xl border border-bc-border bg-bc-elevated p-4 text-sm text-bc-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-bc-accent" aria-hidden />
        <p>
          Automatisches QR-Scannen kommt in einer späteren Version. Bis dahin reicht die Eingabe der
          Ladepunkt-ID.
        </p>
      </div>

      {!user && (
        <p className="mt-4 rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-sm text-bc-warn">
          Zum Starten einer Ladung ist eine{' '}
          <Link to="/anmelden" className="font-medium underline">
            Anmeldung
          </Link>{' '}
          erforderlich. Die Karte können Sie auch ohne Konto nutzen.
        </p>
      )}

      <form onSubmit={submitCode} className="mt-6">
        <label htmlFor="evse-code" className="mb-2 flex items-center gap-2 text-sm font-medium text-bc-text">
          <Keyboard className="h-4 w-4 text-bc-muted" aria-hidden />
          Ladepunkt-ID
        </label>
        <input
          id="evse-code"
          className="input-field font-mono uppercase"
          placeholder="BC-MAC-001"
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

      <p className="mt-6 text-xs text-bc-muted">Schnellauswahl:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickCodes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCode(c);
              lookup(c);
            }}
            className="rounded-lg border border-bc-border px-3 py-1.5 text-xs font-mono text-bc-accent"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
