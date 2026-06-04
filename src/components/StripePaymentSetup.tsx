import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';
import { stripeConfig } from '../config/stripe';

const stripePromise = stripeConfig.publishableKey
  ? loadStripe(stripeConfig.publishableKey)
  : null;

function SetupForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/zahlung`,
      },
      redirect: 'if_required',
    });

    setLoading(false);
    if (submitError) {
      setError(submitError.message ?? 'Speichern fehlgeschlagen');
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error && <p className="text-sm text-bc-danger">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={!stripe || loading}>
        {loading ? 'Wird gespeichert…' : 'Zahlungsmethode speichern'}
      </button>
      <button type="button" className="btn-secondary w-full" onClick={onCancel} disabled={loading}>
        Abbrechen
      </button>
    </form>
  );
}

export function StripePaymentSetup({
  clientSecret,
  onSuccess,
  onCancel,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-bc-warn">
        {import.meta.env.DEV
          ? 'Zahlungsdienst nicht konfiguriert (VITE_STRIPE_PUBLISHABLE_KEY).'
          : 'Zahlungsmethode kann derzeit nicht hinzugefügt werden.'}
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#2ee59d',
            colorBackground: '#0f1419',
            colorText: '#e8eef6',
            colorDanger: '#ff6b6b',
            borderRadius: '12px',
          },
        },
        locale: 'de',
      }}
    >
      <SetupForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
