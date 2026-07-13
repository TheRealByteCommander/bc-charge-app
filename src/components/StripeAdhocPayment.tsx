import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import { stripeConfig } from '../config/stripe';

const stripePromise = stripeConfig.publishableKey
  ? loadStripe(stripeConfig.publishableKey)
  : null;

function PaymentForm({
  onSuccess,
  onCancel,
  preAuthEur,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  preAuthEur: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/laden/gast`,
      },
      redirect: 'if_required',
    });

    setLoading(false);
    if (submitError) {
      setError(submitError.message ?? 'Zahlung fehlgeschlagen');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-bc-muted">
        Es wird eine Vorautorisierung von {preAuthEur.toFixed(2).replace('.', ',')} € auf Ihrer Karte
        vorgenommen. Der tatsächliche Betrag wird nach Ladeende abgebucht.
      </p>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p className="text-sm text-bc-danger" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={!stripe || loading}>
        {loading ? 'Zahlung wird geprüft…' : 'Zahlung bestätigen & laden'}
      </button>
      <button type="button" className="btn-secondary w-full" onClick={onCancel} disabled={loading}>
        Abbrechen
      </button>
    </form>
  );
}

export function StripeAdhocPayment({
  clientSecret,
  preAuthEur,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  preAuthEur: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-bc-warn">
        Zahlungsdienst nicht konfiguriert. Bitte kontaktieren Sie den Support.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#10b981',
            colorBackground: '#ffffff',
            colorText: '#1e293b',
            colorDanger: '#ef4444',
            borderRadius: '12px',
          },
        },
        locale: 'de',
      }}
    >
      <PaymentForm onSuccess={onSuccess} onCancel={onCancel} preAuthEur={preAuthEur} />
    </Elements>
  );
}
