import { z } from 'zod';

export const StripeCustomerSchema = z
  .object({
    customerId: z.string().min(1),
  })
  .passthrough();

export const StripeSetupIntentSchema = z
  .object({
    clientSecret: z.string().min(1),
  })
  .passthrough();

export const StripePaymentMethodSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['card', 'sepa']),
    brand: z.string(),
    last4: z.string(),
    expiry: z.string().optional(),
    label: z.string(),
    isDefault: z.boolean(),
  })
  .passthrough();

export const StripePaymentMethodsEnvelopeSchema = z
  .object({
    paymentMethods: z.array(StripePaymentMethodSchema),
  })
  .passthrough();

export const StripeChargeSessionSchema = z
  .object({
    paymentIntentId: z.string().min(1),
    status: z.string().min(1),
    paid: z.boolean(),
  })
  .passthrough();

export const StripePreauthSessionSchema = z
  .object({
    paymentIntentId: z.string().min(1),
    status: z.string().min(1),
    authorized: z.boolean(),
    preAuthCents: z.union([z.number(), z.string()]).transform((v) => Number(v)),
    preAuthEur: z.union([z.number(), z.string()]).transform((v) => Number(v)).optional(),
  })
  .passthrough();

export const StripeCaptureSessionSchema = z
  .object({
    paymentIntentId: z.string().min(1),
    status: z.string().min(1),
    paid: z.boolean(),
    paymentStatus: z.string().optional(),
    captureCents: z.union([z.number(), z.string()]).transform((v) => Number(v)).optional(),
    cancelled: z.boolean().optional(),
  })
  .passthrough();

export const StripeCancelPreauthSchema = z
  .object({
    paymentIntentId: z.string().min(1),
    status: z.string().min(1),
    cancelled: z.boolean().optional(),
  })
  .passthrough();

export const StripeEmptyOkSchema = z.union([
  z.record(z.unknown()),
  z.null(),
]);
