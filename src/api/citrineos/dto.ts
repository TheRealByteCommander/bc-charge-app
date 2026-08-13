/**
 * Client-edge Zod DTOs for CitrineOS REST/Hasura payloads.
 * Parse-don't-cast at the boundary; map field aliases once (parity with
 * server/services/citrineosServer.normalizeTransactionRow + RestTariff*).
 */

import { z } from 'zod';
import type { CitrineosTariff, CitrineosTransaction } from './types';

const optionalFiniteNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const optionalBoolean = z
  .union([
    z.boolean(),
    z.literal(0),
    z.literal(1),
    z.literal('true'),
    z.literal('false'),
    z.null(),
    z.undefined(),
  ])
  .transform((v): boolean | null => {
    if (v == null) return null;
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === 'true') return true;
    if (v === 0 || v === 'false') return false;
    return null;
  });

/** Raw REST/Hasura transaction row (aliases allowed). */
const RawTransactionSchema = z
  .object({
    transactionId: z.union([z.string(), z.number()]).optional().nullable(),
    id: z.union([z.string(), z.number()]).optional().nullable(),
    stationId: z.union([z.string(), z.number()]).optional().nullable(),
    evseId: z.union([z.string(), z.number()]).optional().nullable(),
    isActive: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    active: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    totalKwh: optionalFiniteNumber.optional(),
    totalEnergyKwh: optionalFiniteNumber.optional(),
    energyKwh: optionalFiniteNumber.optional(),
    totalCost: optionalFiniteNumber.optional(),
    cost: optionalFiniteNumber.optional(),
    timeSpentCharging: optionalFiniteNumber.optional(),
    chargingState: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  })
  .passthrough();

/** REST may wrap a single tx or return a list. */
const TransactionWireSchema = z.union([
  RawTransactionSchema,
  z.array(RawTransactionSchema),
  z
    .object({
      data: z.union([RawTransactionSchema, z.array(RawTransactionSchema)]).optional(),
      transaction: RawTransactionSchema.optional(),
      transactions: z.array(RawTransactionSchema).optional(),
    })
    .passthrough(),
]);

const RawTariffSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional().nullable(),
    currency: z.string().optional().nullable(),
    pricePerKwh: optionalFiniteNumber.optional(),
    pricePerMin: optionalFiniteNumber.optional(),
    pricePerSession: optionalFiniteNumber.optional(),
    taxRate: optionalFiniteNumber.optional(),
  })
  .passthrough();

const TariffListWireSchema = z.union([
  z.array(RawTariffSchema),
  z
    .object({
      data: z.array(RawTariffSchema).optional(),
      tariffs: z.array(RawTariffSchema).optional(),
    })
    .passthrough(),
]);

function coerceOptionalBool(v: unknown): boolean | undefined {
  const r = optionalBoolean.safeParse(v);
  if (!r.success || r.data == null) return undefined;
  return r.data;
}

function firstNumber(...vals: Array<number | null | undefined>): number | null | undefined {
  for (const v of vals) {
    if (v != null && Number.isFinite(v)) return v;
  }
  // Prefer explicit null over missing when any alias was present-as-null
  if (vals.some((v) => v === null)) return null;
  return undefined;
}

/** Map wire transaction → domain DTO (alias fold). */
export function normalizeCitrineosTransaction(raw: unknown): CitrineosTransaction | undefined {
  const parsed = TransactionWireSchema.safeParse(raw);
  if (!parsed.success) return undefined;

  let row: z.infer<typeof RawTransactionSchema> | undefined;
  const v = parsed.data;
  if (Array.isArray(v)) {
    row = v[0];
  } else if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown> & {
      data?: z.infer<typeof RawTransactionSchema> | z.infer<typeof RawTransactionSchema>[];
      transaction?: z.infer<typeof RawTransactionSchema>;
      transactions?: z.infer<typeof RawTransactionSchema>[];
    };
    // Flat row: has transaction id under either alias (before envelope keys).
    const looksFlat =
      obj.transactionId != null ||
      obj.id != null ||
      obj.totalKwh != null ||
      obj.totalEnergyKwh != null ||
      obj.energyKwh != null ||
      obj.chargingState != null ||
      obj.state != null ||
      obj.isActive != null ||
      obj.active != null;
    if (looksFlat && obj.transaction == null && obj.transactions == null && obj.data == null) {
      row = obj as z.infer<typeof RawTransactionSchema>;
    } else if (obj.transaction) {
      row = obj.transaction;
    } else if (Array.isArray(obj.transactions) && obj.transactions[0]) {
      row = obj.transactions[0];
    } else if (Array.isArray(obj.data)) {
      row = obj.data[0];
    } else if (obj.data && typeof obj.data === 'object') {
      row = obj.data as z.infer<typeof RawTransactionSchema>;
    } else if (looksFlat) {
      row = obj as z.infer<typeof RawTransactionSchema>;
    }
  }

  if (!row) return undefined;

  const transactionIdRaw = row.transactionId ?? row.id;
  if (transactionIdRaw == null || transactionIdRaw === '') return undefined;
  const transactionId = String(transactionIdRaw);

  const stationRaw = row.stationId;
  const stationId = stationRaw == null || stationRaw === '' ? '' : String(stationRaw);

  let evseId: number | null | undefined;
  if (row.evseId == null || row.evseId === '') {
    evseId = row.evseId === null ? null : undefined;
  } else {
    const n = Number(row.evseId);
    evseId = Number.isFinite(n) ? n : null;
  }

  const totalKwh = firstNumber(row.totalKwh, row.totalEnergyKwh, row.energyKwh);
  const totalCost = firstNumber(row.totalCost, row.cost);
  const timeSpentCharging = firstNumber(row.timeSpentCharging);
  const isActive = coerceOptionalBool(row.isActive ?? row.active);
  const chargingState =
    (typeof row.chargingState === 'string' && row.chargingState) ||
    (typeof row.state === 'string' && row.state) ||
    null;

  const out: CitrineosTransaction = {
    transactionId,
    stationId,
  };
  if (evseId !== undefined) out.evseId = evseId;
  if (isActive !== undefined) out.isActive = isActive;
  if (totalKwh !== undefined) out.totalKwh = totalKwh;
  if (totalCost !== undefined && totalCost != null) out.totalCost = totalCost;
  if (timeSpentCharging !== undefined) out.timeSpentCharging = timeSpentCharging;
  if (chargingState != null) out.chargingState = chargingState;
  else if (row.chargingState === null || row.state === null) out.chargingState = null;

  return out;
}

/** Map wire tariff list → domain DTOs. */
export function normalizeCitrineosTariffs(raw: unknown): CitrineosTariff[] {
  const parsed = TariffListWireSchema.safeParse(raw);
  if (!parsed.success) return [];

  let items: z.infer<typeof RawTariffSchema>[] = [];
  const v = parsed.data;
  if (Array.isArray(v)) {
    items = v;
  } else if (v && typeof v === 'object') {
    if (Array.isArray(v.tariffs)) items = v.tariffs;
    else if (Array.isArray(v.data)) items = v.data;
  }

  const out: CitrineosTariff[] = [];
  for (const t of items) {
    const tariff: CitrineosTariff = {};
    if (t.id != null && t.id !== '') {
      const idNum = Number(t.id);
      if (Number.isFinite(idNum)) tariff.id = idNum;
    }
    if (typeof t.currency === 'string' && t.currency) tariff.currency = t.currency;
    if (t.pricePerKwh != null) tariff.pricePerKwh = t.pricePerKwh;
    if (t.pricePerMin != null) tariff.pricePerMin = t.pricePerMin;
    if (t.pricePerSession != null) tariff.pricePerSession = t.pricePerSession;
    if (t.taxRate != null) tariff.taxRate = t.taxRate;
    // Keep empty objects only when they carry at least an id or a price signal
    if (
      tariff.id != null ||
      tariff.pricePerKwh != null ||
      tariff.pricePerMin != null ||
      tariff.pricePerSession != null
    ) {
      out.push(tariff);
    }
  }
  return out;
}

/** Normalize a Hasura Transactions[] row (already unwrapped). */
export function normalizeHasuraTransactionRow(raw: unknown): CitrineosTransaction | undefined {
  return normalizeCitrineosTransaction(raw);
}

export {
  RawTransactionSchema,
  TransactionWireSchema,
  RawTariffSchema,
  TariffListWireSchema,
  optionalFiniteNumber,
  optionalBoolean,
};
