import { ArrowLeft, CreditCard, MapPin, Square, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  type AdhocQuote,
  type AdhocSession,
  adhocHealth,
  clearAdhocSessionLocal,
  fetchAdhocQuote,
  loadAdhocSessionLocal,
  pollAdhocSession,
  prepareAdhocPayment,
  saveAdhocSessionLocal,
  startAdhocSession,
  stopAdhocSession,
} from '../api/adhoc/client';
import { StripeAdhocPayment } from '../components/StripeAdhocPayment';
import { getStationById } from '../data/stations';
import { isStripeConfigured } from '../config/stripe';
import { formatCurrency, formatDuration, formatKwh } from '../utils/format';
import { getChargingStateInfo } from '../utils/ocppStateMapping';

type Step = 'quote' | 'payment' | 'starting' | 'charging' | 'done';

export function GuestChargePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stationParam = searchParams.get('station') ?? '';
  const connectorParam = searchParams.get('connector') ?? '';

  const [step, setStep] = useState<Step>('quote');
  const [quote, setQuote] = useState<AdhocQuote | null>(null);
  const [session, setSession] = useState<AdhocSession | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [adhocReady, setAdhocReady] = useState(false);
  const [now, setNow] = useState(Date.now());

  const resolveConnector = useCallback((): string | null => {
    if (connectorParam) return connectorParam;
    const station = getStationById(stationParam);
    const available = station?.connectors.find((c) => c.status === 'available');
    return available?.id ?? station?.connectors[0]?.id ?? null;
  }, [connectorParam, stationParam]);

  useEffect(() => {
    void adhocHealth().then((h) => setAdhocReady(h.ok));
  }, []);

  useEffect(() => {
    const local = loadAdhocSessionLocal();
    if (!local) return;
    void pollAdhocSession(local.sessionId, local.accessToken)
      .then(({ session: s }) => {
        setSession(s);
        if (s.status === 'active') setStep('charging');
        else if (s.status === 'completed') setStep('done');
        else if (s.status === 'payment_pending' && clientSecret) setStep('payment');
      })
      .catch(() => clearAdhocSessionLocal());
  }, [clientSecret]);

  useEffect(() => {
    if (!stationParam) {
      setLoading(false);
      setError('Keine Station angegeben. Bitte scannen Sie den QR-Code an der Säule.');
      return;
    }
    const connectorId = resolveConnector();
    if (!connectorId) {
      setLoading(false);
      setError('Kein Anschluss gefunden. Bitte QR-Code erneut scannen.');
      return;
    }

    setLoading(true);
    setError('');
    void fetchAdhocQuote(stationParam, connectorId)
      .then((q) => {
        setQuote(q);
        setStep('quote');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Tarif konnte nicht geladen werden');
      })
      .finally(() => setLoading(false));
  }, [stationParam, resolveConnector]);

  useEffect(() => {
    if (step !== 'charging' || !session) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      void pollAdhocSession(session.id, session.accessToken)
        .then(({ session: s }) => setSession(s))
        .catch(() => undefined);
    }, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [step, session]);

  const beginPayment = async () => {
    if (!quote) return;
    setError('');
    setLoading(true);
    try {
      const prep = await prepareAdhocPayment({
        stationId: quote.stationId,
        connectorId: quote.connector.id,
        email: email.trim() || undefined,
      });
      saveAdhocSessionLocal(prep.sessionId, prep.accessToken);
      setClientSecret(prep.clientSecret);
      setSession({
        id: prep.sessionId,
        accessToken: prep.accessToken,
        stationId: quote.stationId,
        stationName: quote.stationName,
        connectorId: quote.connector.id,
        connectorType: quote.connector.type,
        powerKw: quote.connector.powerKw,
        pricePerKwh: quote.connector.pricePerKwh,
        sessionFee: quote.connector.sessionFee,
        status: 'payment_pending',
        preAuthCents: prep.preAuthCents,
        energyKwh: 0,
        costEur: quote.connector.sessionFee,
      });
      setStep('payment');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zahlung konnte nicht vorbereitet werden');
    } finally {
      setLoading(false);
    }
  };

  const onPaymentSuccess = async () => {
    const local = loadAdhocSessionLocal();
    if (!local) {
      setError('Sitzung abgelaufen. Bitte erneut starten.');
      setStep('quote');
      return;
    }
    setStep('starting');
    setError('');
    try {
      const { session: started } = await startAdhocSession(local.sessionId, local.accessToken);
      setSession(started);
      setStep('charging');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ladestart fehlgeschlagen');
      setStep('payment');
    }
  };

  const handleStop = async () => {
    if (!session) return;
    setStopping(true);
    setError('');
    try {
      const { session: ended } = await stopAdhocSession(session.id, session.accessToken);
      setSession(ended);
      clearAdhocSessionLocal();
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beenden fehlgeschlagen');
    } finally {
      setStopping(false);
    }
  };

  const elapsedSec =
    session?.startedAt ? Math.floor((now - new Date(session.startedAt).getTime()) / 1000) : 0;
  const chargingStateInfo = getChargingStateInfo(session?.chargingState);

  return (
    <div className="page-shell pb-28">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-bc-muted"
      >
        <ArrowLeft className="h-5 w-5" />
        Zurück
      </button>

      <h1 className="mt-4 font-display text-2xl font-bold">Ohne Konto laden</h1>
      <p className="mt-2 text-sm text-bc-muted">
        Ad-Hoc-Laden per Karte – ohne Registrierung. Ideal für Gäste an der Elinta H2.
      </p>

      {!isStripeConfigured() && (
        <p className="mt-4 rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-sm text-bc-warn">
          Online-Zahlung ist derzeit nicht verfügbar.
        </p>
      )}

      {isStripeConfigured() && !adhocReady && (
        <p className="mt-4 rounded-xl border border-bc-border bg-bc-elevated px-4 py-3 text-sm text-bc-muted">
          Ad-Hoc-Laden ist momentan nicht erreichbar. Bitte prüfen Sie, ob CitrineOS und Stripe
          konfiguriert sind.
        </p>
      )}

      {loading && step === 'quote' && (
        <div className="mt-8 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-bc-accent border-t-transparent" />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-bc-danger/30 bg-bc-danger/10 px-4 py-3 text-sm text-bc-danger" role="alert">
          {error}
        </p>
      )}

      {quote && step === 'quote' && !loading && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
            <p className="font-display text-lg font-semibold">{quote.stationName}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-bc-muted">
              <MapPin className="h-4 w-4" />
              {quote.address}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-bc-muted">Anschluss</p>
                <p className="font-medium">{quote.connector.type}</p>
              </div>
              <div>
                <p className="text-bc-muted">Leistung</p>
                <p className="font-medium">{quote.connector.powerKw} kW</p>
              </div>
              <div>
                <p className="text-bc-muted">Preis</p>
                <p className="font-medium">
                  {quote.connector.pricePerKwh.toFixed(2).replace('.', ',')} €/kWh
                </p>
              </div>
              <div>
                <p className="text-bc-muted">Vorautorisierung</p>
                <p className="font-medium">{formatCurrency(quote.preAuthEur)}</p>
              </div>
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-bc-muted">E-Mail für Beleg (optional)</span>
            <input
              type="email"
              className="input-field mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
              autoComplete="email"
            />
          </label>

          <button
            type="button"
            className="btn-primary flex w-full items-center justify-center gap-2"
            onClick={() => void beginPayment()}
            disabled={!adhocReady}
          >
            <CreditCard className="h-5 w-5" />
            Weiter zur Zahlung
          </button>

          <p className="text-center text-xs text-bc-muted">
            Bereits Kunde?{' '}
            <Link to="/anmelden" className="text-bc-accent underline">
              Anmelden
            </Link>
          </p>
        </div>
      )}

      {step === 'payment' && clientSecret && quote && (
        <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <StripeAdhocPayment
            clientSecret={clientSecret}
            preAuthEur={quote.preAuthEur}
            onSuccess={() => void onPaymentSuccess()}
            onCancel={() => {
              setStep('quote');
              setClientSecret(null);
              clearAdhocSessionLocal();
            }}
          />
        </div>
      )}

      {step === 'starting' && (
        <div className="mt-8 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-bc-accent border-t-transparent" />
          <p className="mt-4 text-bc-muted">Ladevorgang wird gestartet…</p>
        </div>
      )}

      {(step === 'charging' || step === 'done') && session && (
        <div className="mt-6 space-y-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-bc-accent">
              {step === 'done' ? 'Abgeschlossen' : 'Ladevorgang aktiv'}
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold">{session.stationName}</h2>
            {chargingStateInfo && step === 'charging' && (
              <p className="mt-1 text-sm text-bc-muted">{chargingStateInfo.label}</p>
            )}
          </div>

          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4 border-bc-accent/30 bg-bc-accent/5">
            <div className="text-center">
              <Zap className="mx-auto h-8 w-8 text-bc-accent" />
              <p className="mt-2 font-display text-2xl font-bold">{formatKwh(session.energyKwh)}</p>
              <p className="text-xs text-bc-muted">kWh</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-bc-elevated p-3">
              <p className="text-xs text-bc-muted">Kosten</p>
              <p className="font-semibold">{formatCurrency(session.costEur)}</p>
            </div>
            <div className="rounded-xl bg-bc-elevated p-3">
              <p className="text-xs text-bc-muted">Dauer</p>
              <p className="font-semibold">{formatDuration(elapsedSec)}</p>
            </div>
          </div>

          {step === 'charging' && (
            <button
              type="button"
              className="btn-primary flex w-full items-center justify-center gap-2 bg-bc-danger from-bc-danger to-red-600"
              onClick={() => void handleStop()}
              disabled={stopping}
            >
              <Square className="h-5 w-5" />
              {stopping ? 'Wird beendet…' : 'Laden beenden'}
            </button>
          )}

          {step === 'done' && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-bc-muted">
                {session.paymentStatus === 'paid'
                  ? `Es wurden ${formatCurrency((session.captureCents ?? 0) / 100)} abgebucht.`
                  : 'Die Zahlung wird verarbeitet.'}
              </p>
              <Link to="/karte" className="btn-primary inline-block">
                Zur Karte
              </Link>
              <p className="text-xs text-bc-muted">
                <Link to="/registrieren" className="text-bc-accent underline">
                  Konto erstellen
                </Link>{' '}
                für Historie und Vorteile
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
