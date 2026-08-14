import type { ZodType } from 'zod';
import { stripeConfig } from '../../config/stripe';
import { isBackendMode } from '../../services/backendMode';
import { getStripeApiHeaders } from '../../utils/apiAuth';
import {
  ApiParseError,
  errorMessageFromPayload,
  OkEnvelopeSchema,
  parseApiData,
  readResponseJson,
} from '../parse';
import {
  StripeChargeSessionSchema,
  StripeCustomerSchema,
  StripeEmptyOkSchema,
  StripePaymentMethodsEnvelopeSchema,
  StripeSetupIntentSchema,
} from './schemas';

export class StripeApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

type StripeApiOptions = RequestInit & {
  schema?: ZodType;
  allowNonObject?: boolean;
};

async function stripeApi<T>(path: string, options: StripeApiOptions = {}): Promise<T> {
  const { schema, allowNonObject, ...init } = options;
  const url = `${stripeConfig.apiBase}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: isBackendMode() ? 'include' : 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getStripeApiHeaders(),
      ...init.headers,
    },
  });

  let raw: unknown;
  try {
    raw = await readResponseJson(res);
  } catch (e) {
    if (!res.ok) {
      throw new StripeApiError(`Stripe API ${res.status}`, res.status);
    }
    throw e instanceof ApiParseError
      ? new StripeApiError(e.message, res.status)
      : new StripeApiError(`Invalid JSON (HTTP ${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new StripeApiError(
      errorMessageFromPayload(raw, `Stripe API ${res.status}`),
      res.status
    );
  }

  try {
    return parseApiData<T>(raw, schema as ZodType<T> | undefined, `stripe ${path}`, {
      allowNonObject,
    });
  } catch (e) {
    if (e instanceof ApiParseError) {
      throw new StripeApiError(e.message, res.status);
    }
    throw e;
  }
}

export async function stripeHealth(): Promise<{ ok: boolean }> {
  try {
    return await stripeApi<{ ok: boolean }>('/api/stripe/health', { schema: OkEnvelopeSchema });
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
    schema: StripeCustomerSchema,
  });
}

export async function createSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
  return stripeApi('/api/stripe/setup-intent', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
    schema: StripeSetupIntentSchema,
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
  return stripeApi(`/api/stripe/payment-methods?customerId=${encodeURIComponent(customerId)}`, {
    schema: StripePaymentMethodsEnvelopeSchema,
  });
}

export async function setDefaultStripePaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripeApi('/api/stripe/default-payment-method', {
    method: 'POST',
    body: JSON.stringify({ customerId, paymentMethodId }),
    schema: StripeEmptyOkSchema,
    allowNonObject: true,
  });
}

export async function detachStripePaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripeApi('/api/stripe/payment-method', {
    method: 'DELETE',
    body: JSON.stringify({ customerId, paymentMethodId }),
    schema: StripeEmptyOkSchema,
    allowNonObject: true,
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
    schema: StripeChargeSessionSchema,
  });
}
