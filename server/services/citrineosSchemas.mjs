/**
 * Zod schemas for CitrineOS / Hasura wire shapes used by bc-charge-app.
 * Contract source: server/contracts/citrineosContract.mjs + citrineosServer queries.
 * Keep DTO schemas separate from domain mapping (parse-don't-cast at the edge).
 */

import { z } from 'zod';

/** Coerce common numeric/string id forms from Hasura/REST. */
const looseId = z.union([z.string(), z.number()]).transform((v) => String(v));

const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const optionalBoolean = z
  .union([z.boolean(), z.literal(0), z.literal(1), z.literal('true'), z.literal('false'), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === 'true') return true;
    if (v === 0 || v === 'false') return false;
    return null;
  });

/** Hasura Transaction row (BcAdhocTx* / BcActiveTx selections). */
export const HasuraTransactionRowSchema = z
  .object({
    transactionId: z.union([z.string(), z.number()]).optional().nullable(),
    id: z.union([z.string(), z.number()]).optional().nullable(),
    stationId: z.union([z.string(), z.number()]).optional().nullable(),
    isActive: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    active: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    totalKwh: optionalNumber.optional(),
    totalEnergyKwh: optionalNumber.optional(),
    energyKwh: optionalNumber.optional(),
    totalCost: optionalNumber.optional(),
    cost: optionalNumber.optional(),
    chargingState: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    remoteStartId: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

/** REST /data/transactions/transactionType payload (single or wrapped). */
export const RestTransactionSchema = z
  .object({
    transactionId: z.union([z.string(), z.number()]).optional().nullable(),
    id: z.union([z.string(), z.number()]).optional().nullable(),
    isActive: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    active: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    totalKwh: optionalNumber.optional(),
    totalEnergyKwh: optionalNumber.optional(),
    energyKwh: optionalNumber.optional(),
    totalCost: optionalNumber.optional(),
    cost: optionalNumber.optional(),
    chargingState: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  })
  .passthrough();

const TariffSchema = z
  .object({
    pricePerKwh: optionalNumber.optional(),
    pricePerMin: optionalNumber.optional(),
    pricePerSession: optionalNumber.optional(),
    currency: z.string().optional().nullable(),
  })
  .passthrough()
  .nullable()
  .optional();

const ConnectorSchema = z
  .object({
    connectorId: z.union([z.number(), z.string()]),
    status: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    maximumPowerWatts: optionalNumber.optional(),
    Tariff: TariffSchema,
  })
  .passthrough();

const EvseSchema = z
  .object({
    evseId: z.union([z.number(), z.string()]),
    Connectors: z.array(ConnectorSchema).optional().nullable(),
  })
  .passthrough();

const LocationSchema = z
  .object({
    name: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
  })
  .passthrough()
  .nullable()
  .optional();

/** Hasura ChargingStations row (BcAdhocStation* selections). */
export const HasuraChargingStationRowSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    ocppConnectionName: z.string().optional().nullable(),
    isOnline: z.union([z.boolean(), z.number(), z.string()]).optional().nullable(),
    chargePointVendor: z.string().optional().nullable(),
    chargePointModel: z.string().optional().nullable(),
    Location: LocationSchema,
    Evses: z.array(EvseSchema).optional().nullable(),
  })
  .passthrough();

/** Envelope after successful Hasura GraphQL (data only). */
export const HasuraTransactionsDataSchema = z
  .object({
    Transactions: z.array(HasuraTransactionRowSchema).optional().nullable(),
  })
  .passthrough();

export const HasuraChargingStationsDataSchema = z
  .object({
    ChargingStations: z.array(HasuraChargingStationRowSchema).optional().nullable(),
  })
  .passthrough();

/**
 * Incoming CitrineOS webhook body (before internal normalize).
 * Accepts wrapped { data } / { payload } and flat TransactionEvent-ish shapes.
 */
export const CitrineosWebhookRawSchema = z
  .object({
    data: z.record(z.unknown()).optional(),
    payload: z.record(z.unknown()).optional(),
    event: z.unknown().optional(),
    type: z.unknown().optional(),
    transactionId: z.union([z.string(), z.number()]).optional().nullable(),
    transaction_id: z.union([z.string(), z.number()]).optional().nullable(),
    id: z.union([z.string(), z.number()]).optional().nullable(),
    remoteStartId: z.union([z.string(), z.number()]).optional().nullable(),
    remote_start_id: z.union([z.string(), z.number()]).optional().nullable(),
    totalKwh: optionalNumber.optional(),
    totalEnergyKwh: optionalNumber.optional(),
    energyKwh: optionalNumber.optional(),
    total_kwh: optionalNumber.optional(),
    totalCost: optionalNumber.optional(),
    cost: optionalNumber.optional(),
    costEur: optionalNumber.optional(),
    total_cost: optionalNumber.optional(),
    isActive: optionalBoolean.optional(),
    active: optionalBoolean.optional(),
    is_active: optionalBoolean.optional(),
    status: z.string().optional().nullable(),
    eventType: z.string().optional().nullable(),
    event_type: z.string().optional().nullable(),
    seqNo: optionalNumber.optional(),
    seq_no: optionalNumber.optional(),
    triggerReason: z.string().optional().nullable(),
    meterValue: z.unknown().optional(),
    meterValues: z.unknown().optional(),
    transactionInfo: z.record(z.unknown()).optional(),
    transaction: z.record(z.unknown()).optional(),
  })
  .passthrough();

/** REST tariff list item (best-effort; upstream fields vary). */
export const RestTariffItemSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    pricePerKwh: optionalNumber.optional(),
    pricePerMin: optionalNumber.optional(),
    pricePerSession: optionalNumber.optional(),
    currency: z.string().optional().nullable(),
  })
  .passthrough();

export const RestTariffListSchema = z.union([
  z.array(RestTariffItemSchema),
  z
    .object({
      data: z.array(RestTariffItemSchema).optional(),
      tariffs: z.array(RestTariffItemSchema).optional(),
    })
    .passthrough(),
]);

export const CANARY_SCHEMA_IDS = /** @type {const} */ ([
  'hasura.transaction',
  'hasura.transactionsData',
  'hasura.chargingStation',
  'hasura.chargingStationsData',
  'rest.transaction',
  'rest.tariffList',
  'webhook.citrineos.raw',
]);

/** @type {Record<string, import('zod').ZodTypeAny>} */
export const canarySchemas = {
  'hasura.transaction': HasuraTransactionRowSchema,
  'hasura.transactionsData': HasuraTransactionsDataSchema,
  'hasura.chargingStation': HasuraChargingStationRowSchema,
  'hasura.chargingStationsData': HasuraChargingStationsDataSchema,
  'rest.transaction': RestTransactionSchema,
  'rest.tariffList': RestTariffListSchema,
  'webhook.citrineos.raw': CitrineosWebhookRawSchema,
};

export { looseId, optionalNumber, optionalBoolean };
