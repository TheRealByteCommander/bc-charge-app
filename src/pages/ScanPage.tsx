import { Camera, Keyboard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStationByEvseCode } from '../data/stations';
import { useAppStore } from '../store/appStore';

export function ScanPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError('Kamera nicht verfügbar. Bitte Ladepunkt-ID manuell eingeben.');
        setCameraOn(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn]);

  const quickCodes = ['BC-MAC-001', 'BC-LEI-002', 'BC-LEI-006'];

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Ladepunkt scannen</h1>
      <p className="mt-2 text-bc-muted">
        Scannen Sie den QR-Code am BC-Charge-Ladepunkt oder geben Sie die Standort-ID ein.
      </p>

      {!user && (
        <p className="mt-4 rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-sm text-bc-warn">
          Zum Starten einer Ladung ist eine Anmeldung erforderlich.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-bc-border bg-bc-surface">
        {cameraOn ? (
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 text-bc-muted">
            <Camera className="h-12 w-12 opacity-50" />
            <p className="text-sm">Kamera für QR-Erkennung aktivieren</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-primary mt-4 w-full"
        onClick={() => {
          setError('');
          setCameraOn((v) => !v);
        }}
      >
        {cameraOn ? 'Kamera beenden' : 'Kamera starten'}
      </button>

      <form onSubmit={submitCode} className="mt-6">
        <label className="mb-2 flex items-center gap-2 text-sm text-bc-muted">
          <Keyboard className="h-4 w-4" />
          Ladepunkt-ID (z. B. BC-MAC-001)
        </label>
        <input
          className="input-field uppercase"
          placeholder="BC-XXX-000"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p className="mt-2 text-sm text-bc-danger">{error}</p>}
        <button type="submit" className="btn-secondary mt-3 w-full">
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
