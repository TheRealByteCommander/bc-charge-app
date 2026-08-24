import { z } from 'zod';

const finiteNumber = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected finite number' });
    return z.NEVER;
  }
  return n;
});

export const AdhocQuoteSchema = z
  .object({
    stationId: z.string().min(1),
    stationName: z.string(),
    address: z.string(),
    connector: z
      .object({
        id: z.string().min(1),
        type: z.string(),
        powerKw: finiteNumber,
        pricePerKwh: finiteNumber,
        sessionFee: finiteNumber,
        pricePerMin: finiteNumber,
      })
      .passthrough(),
    preAuthCents: finiteNumber,
    preAuthEur: finiteNumber,
    currency: z.string().min(1),
  })
  .passthrough();

export const AdhocSessionSchema = z
  .object({
    id: z.string().min(1),
    accessToken: z.string().min(1),
    stationId: z.string().min(1),
    stationName: z.string(),
    address: z.string().optional(),
    connectorId: z.string().min(1),
    connectorType: z.string(),
    powerKw: finiteNumber,
    pricePerKwh: finiteNumber,
    sessionFee: finiteNumber,
    status: z.enum(['payment_pending', 'active', 'completed']),
    paymentIntentId: z.string().optional(),
    preAuthCents: finiteNumber,
    energyKwh: finiteNumber,
    costEur: finiteNumber,
    startedAt: z.string().nullable().optional(),
    endedAt: z.string().optional(),
    chargingState: z.string().nullable().optional(),
    paymentStatus: z.string().optional(),
    captureCents: finiteNumber.optional(),
  })
  .passthrough();

export const AdhocSessionEnvelopeSchema = z
  .object({
    session: AdhocSessionSchema,
  })
  .passthrough();

export const AdhocPreparePaymentSchema = z
  .object({
    sessionId: z.string().min(1),
    accessToken: z.string().min(1),
    clientSecret: z.string().min(1),
    preAuthCents: finiteNumber,
  })
  .passthrough();

/** sessionStorage resume envelope for guest ad-hoc charge (id + capability token only). */
export const AdhocLocalSessionSchema = z
  .object({
    sessionId: z.string().min(1),
    accessToken: z.string().min(1),
  })
  .strict();

export type AdhocLocalSession = z.infer<typeof AdhocLocalSessionSchema>;
