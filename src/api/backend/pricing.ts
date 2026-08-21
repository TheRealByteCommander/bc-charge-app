import { z } from 'zod';
import { OkEnvelopeSchema } from '../parse';
import { backendApi } from './client';

const finiteNumber = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected finite number' });
    return z.NEVER;
  }
  return n;
});

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? undefined : v));

const decimalString = z.union([z.string(), z.number()]).transform((v, ctx) => {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected finite number' });
      return z.NEVER;
    }
    return String(v);
  }
  const t = v.trim();
  if (!t) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected non-empty decimal' });
    return z.NEVER;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected finite decimal' });
    return z.NEVER;
  }
  return t;
});

export const TariffComponentSchema = z
  .object({
    kind: z.enum(['energy', 'time', 'session', 'idle', 'reservation']).or(z.string()),
    rate: decimalString,
    priority: finiteNumber.optional(),
    idleGraceSeconds: finiteNumber.optional(),
  })
  .passthrough();

export const TariffVersionSchema = z
  .object({
    id: z.string().min(1),
    tariffId: z.string().min(1),
    version: finiteNumber,
    status: z.string().default('draft'),
    name: optionalString,
    validFrom: z.string().min(1),
    validTo: z.union([z.string(), z.null()]).optional().nullable(),
    timezone: z.string().default('Europe/Berlin'),
    currency: z.string().default('EUR'),
    taxRateBp: finiteNumber.default(1900),
    components: z.array(TariffComponentSchema).default([]),
    minPrice: z.union([decimalString, z.null()]).optional().nullable(),
    maxPrice: z.union([decimalString, z.null()]).optional().nullable(),
    hash: z.string().default(''),
  })
  .passthrough();

export type TariffComponentDto = z.output<typeof TariffComponentSchema>;
export type TariffVersionDto = z.output<typeof TariffVersionSchema>;

export const PricingCostLineSchema = z
  .object({
    code: z.string().default(''),
    kind: z.string().default(''),
    label: z.string().default(''),
    grossEur: decimalString,
    netEur: decimalString.optional(),
    taxEur: decimalString.optional(),
  })
  .passthrough();

export const PricingPreviewResultSchema = z
  .object({
    snapshot: z
      .object({
        hash: z.string().min(1),
        frozenAt: z.string().min(1),
      })
      .passthrough(),
    cost: z
      .object({
        netEur: decimalString,
        taxEur: decimalString,
        grossEur: decimalString,
        energyWh: finiteNumber.default(0),
        lines: z.array(PricingCostLineSchema).default([]),
      })
      .passthrough(),
  })
  .passthrough();

export type PricingPreviewResult = z.output<typeof PricingPreviewResultSchema>;

export const PricingTariffsEnvelopeSchema = z
  .object({
    tariffs: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().default(''),
          citrineos_tariff_id: optionalString,
        })
        .passthrough()
    ),
  })
  .passthrough();

export const TariffVersionsEnvelopeSchema = z
  .object({
    versions: z.array(TariffVersionSchema),
  })
  .passthrough();

export const TariffAuditEnvelopeSchema = z
  .object({
    audit: z.array(
      z
        .object({
          action: z.string().default(''),
          created_at: z.string().default(''),
          actor: optionalString,
        })
        .passthrough()
    ),
  })
  .passthrough();

export const OcpiTariffsEnvelopeSchema = z
  .object({
    tariffs: z.array(z.unknown()).default([]),
    version: z.string().default('2.2.1'),
  })
  .passthrough();

export async function fetchPricingTariffs() {
  return backendApi('/api/pricing/tariffs', { schema: PricingTariffsEnvelopeSchema });
}

export async function fetchTariffVersions(tariffId: string) {
  return backendApi(`/api/pricing/tariffs/${encodeURIComponent(tariffId)}/versions`, {
    schema: TariffVersionsEnvelopeSchema,
  });
}

export async function fetchTariffAudit(tariffId: string) {
  return backendApi(`/api/pricing/tariffs/${encodeURIComponent(tariffId)}/audit`, {
    schema: TariffAuditEnvelopeSchema,
  });
}

export async function previewPricing(body: {
  tariffVersion: Partial<TariffVersionDto>;
  events: Array<Record<string, unknown>>;
  midCertified?: boolean;
}) {
  return backendApi('/api/pricing/preview', {
    method: 'POST',
    body: JSON.stringify(body),
    schema: PricingPreviewResultSchema,
  });
}

export async function activateTariffVersion(tariffId: string, versionId: string) {
  return backendApi(
    `/api/pricing/tariffs/${encodeURIComponent(tariffId)}/versions/${encodeURIComponent(versionId)}/activate`,
    {
      method: 'POST',
      schema: OkEnvelopeSchema,
    }
  );
}

export async function rollbackTariffVersion(tariffId: string, versionId: string) {
  return backendApi(
    `/api/pricing/tariffs/${encodeURIComponent(tariffId)}/versions/${encodeURIComponent(versionId)}/rollback`,
    {
      method: 'POST',
      schema: OkEnvelopeSchema,
    }
  );
}

export async function fetchOcpiTariffs() {
  return backendApi('/api/pricing/ocpi/tariffs', { schema: OcpiTariffsEnvelopeSchema });
}
