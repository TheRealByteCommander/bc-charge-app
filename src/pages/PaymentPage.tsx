import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StripePaymentSetup } from '../components/StripePaymentSetup';
import { isStripeConfigured } from '../config/stripe';
import { prepareSetupIntent } from '../services/stripeService';
import { useAppStore } from '../store/appStore';

export function PaymentPage() {
  const user = useAppStore((s) => s.user);
  const stripeReady = useAppStore((s) => s.stripeReady);
  const syncStripePayments = useAppStore((s) => s.syncStripePayments);
  const removePaymentMethod = useAppStore((s) => s.removePaymentMethod);
  const setDefaultPayment = useAppStore((s) => s.setDefaultPayment);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const openStripeSetup = async () => {
    setError(null);
    setLoadingSetup(true);
    try {
      if (!user.stripeCustomerId) {
        await syncStripePayments();
      }
      const u = useAppStore.getState().user;
      if (!u?.stripeCustomerId) {
        setError('Stripe-Kunde konnte nicht angelegt werden.');
        return;
      }
      const secret = await prepareSetupIntent(u.stripeCustomerId);
      setClientSecret(secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup fehlgeschlagen');
    } finally {
      setLoadingSetup(false);
    }
  };

  const stripeConfigured = isStripeConfigured();

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Zahlung</h1>
      <p className="mt-1 text-bc-muted">
        Sichere Abrechnung über <span className="text-bc-text font-medium">Stripe</span> nach jeder
        Ladesitzung.
      </p>

      {stripeConfigured && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-bc-border bg-bc-elevated px-3 py-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${stripeReady ? 'bg-bc-accent' : 'bg-bc-warn'}`}
          />
          {stripeReady
            ? 'Stripe verbunden'
            : 'Stripe-Server nicht erreichbar – im Projektordner: npm run dev:stripe (oder npm run dev:all)'}
        </div>
      )}

      {!stripeConfigured && (
        <p className="mt-4 rounded-xl border border-bc-warn/30 bg-bc-warn/10 px-4 py-3 text-sm text-bc-warn">
          Stripe-Schlüssel fehlen (VITE_STRIPE_PUBLISHABLE_KEY / STRIPE_SECRET_KEY in .env).
        </p>
      )}

      <div className="mt-6 space-y-3">
        {user.paymentMethods.length === 0 && (
          <p className="rounded-xl border border-bc-border p-4 text-center text-sm text-bc-muted">
            Noch keine Zahlungsmethode hinterlegt.
          </p>
        )}
        {user.paymentMethods.map((pm) => (
          <div
            key={pm.id}
            className={`rounded-2xl border p-4 ${pm.isDefault ? 'border-bc-accent bg-bc-accent/5' : 'border-bc-border bg-bc-elevated'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-bc-accent" />
                <div>
                  <p className="font-medium">
                    {pm.label} {pm.last4 && `•••• ${pm.last4}`}
                  </p>
                  {pm.expiry && <p className="text-xs text-bc-muted">Gültig bis {pm.expiry}</p>}
                  {pm.isDefault && <p className="text-xs text-bc-accent">Standard</p>}
                  {pm.stripePaymentMethodId && (
                    <p className="text-xs text-bc-muted">via Stripe</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!pm.isDefault && (
                  <button
                    type="button"
                    className="text-xs text-bc-accent"
                    onClick={() => void setDefaultPayment(pm.id)}
                  >
                    Standard
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
        ))}
      </div>

      {clientSecret ? (
        <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-elevated p-4">
          <h2 className="font-display font-semibold">Karte oder SEPA hinzufügen</h2>
          <StripePaymentSetup
            clientSecret={clientSecret}
            onSuccess={() => {
              setClientSecret(null);
              void syncStripePayments();
            }}
            onCancel={() => setClientSecret(null)}
          />
        </div>
      ) : (
        stripeConfigured && (
          <button
            type="button"
            className="btn-secondary mt-6 flex w-full items-center justify-center gap-2"
            onClick={openStripeSetup}
            disabled={loadingSetup || !stripeReady}
          >
            <Plus className="h-5 w-5" />
            {loadingSetup ? 'Wird vorbereitet…' : 'Zahlungsmethode mit Stripe hinzufügen'}
          </button>
        )
      )}

      {error && <p className="mt-3 text-sm text-bc-danger">{error}</p>}

      <p className="mt-8 text-xs text-bc-muted leading-relaxed">
        Zahlungen werden nach Ladeende automatisch über Stripe abgebucht (Payment Intent, off-session).
        Kartendaten werden nicht auf unseren Servern gespeichert, sondern bei Stripe (PCI DSS).
      </p>
    </div>
  );
}
