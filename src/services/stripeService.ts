import {
  chargeSession,
  createSetupIntent,
  createStripeCustomer,
  listStripePaymentMethods,
  setDefaultStripePaymentMethod,
  detachStripePaymentMethod,
  stripeHealth,
  type StripePaymentMethodDto,
} from '../api/stripe/client';
import { isStripeConfigured } from '../config/stripe';
import type { PaymentMethod, UserProfile } from '../types';

export function mapStripeToPaymentMethod(pm: StripePaymentMethodDto): PaymentMethod {
  return {
    id: pm.id,
    type: pm.type === 'sepa' ? 'sepa' : 'card',
    label: pm.label,
    last4: pm.last4,
    isDefault: pm.isDefault,
    expiry: pm.expiry,
    stripePaymentMethodId: pm.id,
  };
}

export async function isStripeBackendReady(): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  const h = await stripeHealth();
  return h.ok;
}

export async function ensureStripeCustomer(user: UserProfile): Promise<string | null> {
  if (!isStripeConfigured()) return null;
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const { customerId } = await createStripeCustomer({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    userId: user.id,
  });
  return customerId;
}

export async function fetchStripePaymentMethods(
  customerId: string
): Promise<PaymentMethod[]> {
  const { paymentMethods } = await listStripePaymentMethods(customerId);
  return paymentMethods.map(mapStripeToPaymentMethod);
}

export async function prepareSetupIntent(customerId: string): Promise<string> {
  const { clientSecret } = await createSetupIntent(customerId);
  if (!clientSecret) throw new Error('SetupIntent konnte nicht erstellt werden');
  return clientSecret;
}

export async function chargeChargingSession(
  user: UserProfile,
  paymentMethodId: string,
  amountEur: number,
  sessionId: string,
  description: string
): Promise<{ paid: boolean; paymentIntentId: string; status: string }> {
  if (!user.stripeCustomerId) {
    throw new Error('Kein Stripe-Kunde hinterlegt');
  }
  const pm = user.paymentMethods.find((p) => p.id === paymentMethodId);
  const stripePmId = pm?.stripePaymentMethodId ?? paymentMethodId;
  const amountCents = Math.min(25_000, Math.max(50, Math.round(amountEur * 100)));

  return chargeSession({
    userId: user.id,
    customerId: user.stripeCustomerId,
    paymentMethodId: stripePmId,
    amountCents,
    currency: 'eur',
    description,
    sessionId,
    sessionCostEur: amountEur,
  });
}

export {
  setDefaultStripePaymentMethod,
  detachStripePaymentMethod,
};
