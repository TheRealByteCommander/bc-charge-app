import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StripePaymentSetup } from '../components/StripePaymentSetup';
import { isStripeConfigured } from '../config/stripe';
import { prepareSetupIntent } from '../services/stripeService';
import { useAppStore } from '../store/appStore';

export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const user = useAppStore((s) => s.user);
  const paymentsOnline = useAppStore((s) => s.stripeReady);
  const syncStripePayments = useAppStore((s) => s.syncStripePayments);
  const removePaymentMethod = useAppStore((s) => s.removePaymentMethod);
  const setDefaultPayment = useAppStore((s) => s.setDefaultPayment);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentsEnabled = isStripeConfigured();

  useEffect(() => {
    if (user) void syncStripePayments();
  }, [user, syncStripePayments]);

  if (!user) {
    return (
      <div className="page-shell">
        <Link to="/anmelden" className="btn-primary">
          Anmelden
        </Link>
      </div>
    );
  }

  const openAddPayment = async () => {
    setError(null);
    setLoadingSetup(true);
    try {
      if (!user.stripeCustomerId) {
        await syncStripePayments();
      }
      const u = useAppStore.getState().user;
      if (!u?.stripeCustomerId) {
        setError('Zahlungsmethode konnte nicht vorbereitet werden. Bitte später erneut versuchen.');
        return;
      }
      const secret = await prepareSetupIntent(u.stripeCustomerId);
      setClientSecret(secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setLoadingSetup(false);
    }
  };

  return (
    <div className="page-shell">
      {returnTo ? (
        <Link to={returnTo} className="text-sm text-bc-accent">
          ← Zurück zur Station
        </Link>
      ) : (
        <Link to="/profil" className="text-sm text-bc-accent">
          ← Profil
        </Link>
      )}
      <h1 className="mt-4 font-display text-2xl font-bold">Zahlung</h1>
      <p className="mt-2 text-sm text-bc-muted leading-relaxed">
        Hinterlegen Sie Karte oder SEPA-Lastschrift. Nach jeder Ladesitzung wird der Betrag automatisch
        abgebucht.
      </p>

      {!paymentsEnabled && (
        <p className="mt-4 rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-sm text-bc-warn">
          {import.meta.env.DEV
            ? 'Zahlungsdienst nicht konfiguriert (Umgebungsvariablen prüfen).'
            : 'Online-Zahlung ist derzeit nicht verfügbar. Bitte kontaktieren Sie den Support.'}
        </p>
      )}

      {paymentsEnabled && !paymentsOnline && (
        <p className="mt-4 rounded-xl border border-bc-border bg-bc-elevated px-4 py-3 text-sm text-bc-muted">
          {import.meta.env.DEV
            ? 'Zahlungsdienst offline – npm run dev:all starten.'
            : 'Zahlungsdienst momentan nicht erreichbar. Bitte kurz warten und die Seite erneut öffnen.'}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {user.paymentMethods.length === 0 ? (
          <p className="rounded-xl border border-bc-border bg-bc-elevated p-6 text-center text-sm text-bc-muted">
            Noch keine Zahlungsmethode hinterlegt.
          </p>
        ) : (
          user.paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`rounded-2xl border p-4 ${
                pm.isDefault ? 'border-bc-accent bg-bc-accent/5' : 'border-bc-border bg-bc-elevated'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CreditCard className="h-6 w-6 shrink-0 text-bc-accent" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {pm.label}
                      {pm.last4 ? ` · •••• ${pm.last4}` : ''}
                    </p>
                    {pm.expiry && <p className="text-xs text-bc-muted">Gültig bis {pm.expiry}</p>}
                    {pm.isDefault && <p className="text-xs text-bc-accent">Standard-Zahlungsmittel</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!pm.isDefault && (
                    <button
                      type="button"
                      className="text-xs text-bc-accent"
                      onClick={() => void setDefaultPayment(pm.id)}
                    >
                      Als Standard
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void removePaymentMethod(pm.id)}
                    className="text-bc-danger"
                    aria-label="Entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {clientSecret ? (
        <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-elevated p-4">
          <h2 className="font-display font-semibold">Zahlungsmethode hinzufügen</h2>
          <p className="mt-1 text-sm text-bc-muted">Kreditkarte, Debitkarte oder SEPA-Lastschrift</p>
          <div className="mt-4">
            <StripePaymentSetup
              clientSecret={clientSecret}
              onSuccess={() => {
                setClientSecret(null);
                void syncStripePayments();
              }}
              onCancel={() => setClientSecret(null)}
            />
          </div>
        </div>
      ) : (
        paymentsEnabled && (
          <button
            type="button"
            className="btn-primary mt-6 flex w-full items-center justify-center gap-2"
            onClick={openAddPayment}
            disabled={loadingSetup || !paymentsOnline}
          >
            <Plus className="h-5 w-5" />
            {loadingSetup ? 'Wird vorbereitet…' : 'Zahlungsmethode hinzufügen'}
          </button>
        )
      )}

      {error && <p className="mt-3 text-sm text-bc-danger">{error}</p>}

      <p className="mt-8 text-xs text-bc-muted leading-relaxed">
        Kartendaten werden verschlüsselt übermittelt und nicht auf unseren Servern gespeichert.{' '}
        <Link to="/datenschutz" className="text-bc-accent">
          Datenschutz
        </Link>
      </p>
    </div>
  );
}
