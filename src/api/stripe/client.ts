import { stripeConfig } from '../../config/stripe';
import { isBackendMode } from '../../services/backendMode';
import { getStripeApiHeaders } from '../../utils/apiAuth';

export class StripeApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

async function stripeApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${stripeConfig.apiBase}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: isBackendMode() ? 'include' : 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getStripeApiHeaders(),
      ...options.headers,
    },
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new StripeApiError(data.error ?? `Stripe API ${res.status}`, res.status);
  }
  return data as T;
}

export async function stripeHealth(): Promise<{ ok: boolean }> {
  try {
    return await stripeApi<{ ok: boolean }>('/api/stripe/health');
  } catch {
    return { ok: false };
  }
}

export async function createStripeCustomer(params: {
  email: string;
  name: string;
  userId: string;
}): Promise<{ customerId: string }> {
  return stripeApi('/api/stripe/customer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
  return stripeApi('/api/stripe/setup-intent', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
}

export interface StripePaymentMethodDto {
  id: string;
  type: 'card' | 'sepa';
  brand: string;
  last4: string;
  expiry?: string;
  label: string;
  isDefault: boolean;
}

export async function listStripePaymentMethods(
  customerId: string
): Promise<{ paymentMethods: StripePaymentMethodDto[] }> {
  return stripeApi(`/api/stripe/payment-methods?customerId=${encodeURIComponent(customerId)}`);
}

export async function setDefaultStripePaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripeApi('/api/stripe/default-payment-method', {
    method: 'POST',
    body: JSON.stringify({ customerId, paymentMethodId }),
  });
}

export async function detachStripePaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripeApi('/api/stripe/payment-method', {
    method: 'DELETE',
    body: JSON.stringify({ customerId, paymentMethodId }),
  });
}

export async function chargeSession(params: {
  userId: string;
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  sessionId?: string;
  sessionCostEur?: number;
}): Promise<{ paymentIntentId: string; status: string; paid: boolean }> {
  return stripeApi('/api/stripe/charge-session', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
