/**
 * Client-edge Zod DTOs for BC backend auth/session/profile envelopes.
 * Parse-don't-cast at the fetch boundary; keep wire tolerant (passthrough +
 * number/string coercion) while requiring identity + billable fields.
 */

import { z } from 'zod';
import type {
  ChargingSession,
  LoyaltyTier,
  RewardFulfillment,
  UserProfile,
} from '../../types';
import type { GamificationState } from '../../types/gamification';

const finiteNumber = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expected finite number' });
    return z.NEVER;
  }
  return n;
});

const optionalFiniteNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v): number | undefined => {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? undefined : v));

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === undefined ? null : v));

const stringArray = z
  .array(z.union([z.string(), z.number()]))
  .transform((arr): string[] => arr.map((x) => String(x)));

export const ConnectorTypeSchema = z.enum(['CCS', 'Type2', 'CHAdeMO']);

export const LoyaltyTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum']);

export const SessionStatusSchema = z.enum(['active', 'completed', 'cancelled']);

export const PaymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'skipped']);

export const VehicleSchema = z
  .object({
    id: z.string().min(1),
    nickname: z.string().default(''),
    brand: z.string().default(''),
    model: z.string().default(''),
    batteryKwh: finiteNumber.default(0),
    maxAcKw: finiteNumber.default(0),
    maxDcKw: finiteNumber.default(0),
    preferredConnector: ConnectorTypeSchema.or(z.string()).default('Type2'),
    licensePlate: z.string().default(''),
  })
  .passthrough();

export const PaymentMethodSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['card', 'sepa', 'paypal']).or(z.string()),
    label: z.string().default(''),
    last4: optionalString,
    isDefault: z.boolean().default(false),
    expiry: optionalString,
    stripePaymentMethodId: optionalString,
  })
  .passthrough();

export const NotificationPrefsSchema = z
  .object({
    sessionComplete: z.boolean().default(true),
    promotions: z.boolean().default(false),
    stationAvailability: z.boolean().default(false),
    loyaltyUpdates: z.boolean().default(true),
  })
  .passthrough();

export const ChargingPlanPrefsSchema = z
  .object({
    enabled: z.boolean().default(true),
    snoozedUntil: z.union([z.string(), z.null()]).default(null),
    expandedOnHome: z.boolean().default(false),
  })
  .passthrough();

export const GamificationStateSchema = z
  .object({
    unlockedBadgeIds: stringArray.default([]),
    currentStreakDays: finiteNumber.default(0),
    longestStreakDays: finiteNumber.default(0),
    lastChargeDay: z.union([z.string(), z.null()]).default(null),
    weeklyPoints: finiteNumber.default(0),
    weekKey: z.union([z.string(), z.null()]).default(null),
    completedChallengeIds: stringArray.default([]),
    uniqueStationsCharged: stringArray.default([]),
    sessionsThisWeek: finiteNumber.default(0),
    stationsThisWeek: stringArray.default([]),
    reportsSubmitted: finiteNumber.default(0),
  })
  .passthrough();

/** Server rowToProfile shape — passwordHash always blank on wire. */
export const UserProfileSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().min(1),
    passwordHash: z.string().optional().default(''),
    firstName: z.string().default(''),
    lastName: z.string().default(''),
    phone: z.string().default(''),
    memberSince: z.string().default(''),
    membershipId: z.string().default(''),
    loyaltyPoints: finiteNumber.default(0),
    // Accept corrupt wire values (e.g. `{}` from un-awaited Promise JSON) and coerce.
    loyaltyTier: z
      .union([LoyaltyTierSchema, z.string(), z.null(), z.undefined(), z.record(z.unknown()), z.number()])
      .transform((v) => {
        if (typeof v === 'string' && v.trim()) return v;
        return 'bronze';
      })
      .default('bronze'),
    totalKwh: finiteNumber.default(0),
    totalSessions: finiteNumber.default(0),
    co2SavedKg: finiteNumber.default(0),
    vehicles: z.array(VehicleSchema).default([]),
    paymentMethods: z.array(PaymentMethodSchema).default([]),
    favoriteStationIds: stringArray.default([]),
    notifications: NotificationPrefsSchema.default({}),
    chargingPlan: ChargingPlanPrefsSchema.default({}),
    gamification: GamificationStateSchema.default({}),
    stripeCustomerId: optionalString,
    privacyConsentAt: optionalString,
    termsAcceptedAt: optionalString,
    marketingConsentAt: z.union([z.string(), z.null()]).optional(),
    prioritySupportUntil: optionalString,
  })
  .passthrough();

export const ChargingSessionSchema = z
  .object({
    id: z.string().min(1),
    stationId: z.string().min(1),
    stationName: z.string().default(''),
    connectorId: z.string().min(1),
    connectorType: ConnectorTypeSchema.or(z.string()).default('Type2'),
    powerKw: finiteNumber.default(0),
    vehicleId: z.string().default(''),
    paymentMethodId: z.string().default(''),
    startedAt: z.string().min(1),
    endedAt: optionalString,
    status: SessionStatusSchema,
    energyKwh: finiteNumber.default(0),
    costEur: finiteNumber.default(0),
    pricePerKwh: finiteNumber.default(0),
    sessionFee: finiteNumber.default(0),
    pointsEarned: finiteNumber.default(0),
    citrineosTransactionId: optionalString,
    citrineosStationDbId: optionalFiniteNumber,
    remoteStartId: optionalFiniteNumber,
    citrineosBacked: z.boolean().optional(),
    stripePaymentIntentId: optionalString,
    paymentStatus: PaymentStatusSchema.or(z.string()).optional(),
    invoiceNumber: optionalString,
    invoiceEmailedAt: z.union([z.string(), z.null()]).optional(),
    midCertified: z.boolean().optional(),
    chargePointModel: optionalString,
    evseNumber: optionalFiniteNumber,
    chargingState: z.union([z.string(), z.null()]).optional(),
    appliedFulfillmentId: optionalString,
    baseCostEur: optionalFiniteNumber,
    rewardDiscountEur: optionalFiniteNumber,
    rewardLabel: optionalString,
    pricePerMin: optionalFiniteNumber,
    currency: optionalString,
    tariffSnapshotId: optionalString,
    tariffSnapshotHash: optionalString,
    tariffVersionId: optionalString,
    /** Live Citrine flags sometimes present on account sessions */
    citrineosTxActive: z.boolean().optional(),
    tariffId: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export const RewardFulfillmentSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    rewardId: z.string().min(1),
    type: z.string().min(1),
    status: z.enum(['active', 'used', 'expired']).or(z.string()),
    payload: z.record(z.unknown()).default({}),
    redeemedAt: z.string().default(''),
    expiresAt: nullableString.default(null),
    usedAt: nullableString.default(null),
    sessionId: nullableString.default(null),
    isActive: z.boolean().optional(),
  })
  .passthrough();

// --- Envelopes -------------------------------------------------------------

export const AuthUserEnvelopeSchema = z
  .object({
    user: UserProfileSchema,
  })
  .passthrough();

export const SessionsListEnvelopeSchema = z
  .object({
    sessions: z.array(ChargingSessionSchema),
  })
  .passthrough();

export const SessionEnvelopeSchema = z
  .object({
    session: ChargingSessionSchema.nullable(),
  })
  .passthrough();

export const SessionRequiredEnvelopeSchema = z
  .object({
    session: ChargingSessionSchema,
  })
  .passthrough();

export const SessionAbandonEnvelopeSchema = z
  .object({
    session: ChargingSessionSchema,
    abandoned: z.boolean().optional(),
  })
  .passthrough();

export const SessionCompleteEnvelopeSchema = z
  .object({
    session: ChargingSessionSchema,
    user: UserProfileSchema,
    invoice: z
      .object({
        invoiceNumber: optionalString,
        emailSent: z.boolean().optional(),
        emailSkipped: z.boolean().optional(),
        error: optionalString,
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const RedeemedRewardsEnvelopeSchema = z
  .object({
    rewardIds: stringArray,
  })
  .passthrough();

export const RedeemRewardEnvelopeSchema = z
  .object({
    user: UserProfileSchema,
    rewardIds: stringArray,
    fulfillment: RewardFulfillmentSchema,
  })
  .passthrough();

// --- Narrowed domain mappers (Zod output → app types) ----------------------

function asLoyaltyTier(v: string): LoyaltyTier {
  if (v === 'bronze' || v === 'silver' || v === 'gold' || v === 'platinum') return v;
  return 'bronze';
}

function asConnectorType(v: string): ChargingSession['connectorType'] {
  if (v === 'CCS' || v === 'Type2' || v === 'CHAdeMO') return v;
  return 'Type2';
}

function asSessionStatus(v: string): ChargingSession['status'] {
  if (v === 'active' || v === 'completed' || v === 'cancelled') return v;
  return 'completed';
}

function asPaymentStatus(
  v: string | undefined
): ChargingSession['paymentStatus'] | undefined {
  if (v == null) return undefined;
  if (v === 'pending' || v === 'paid' || v === 'failed' || v === 'skipped') return v;
  return undefined;
}

export type UserProfileWire = z.output<typeof UserProfileSchema>;
export type ChargingSessionWire = z.output<typeof ChargingSessionSchema>;
export type RewardFulfillmentWire = z.output<typeof RewardFulfillmentSchema>;

export function toUserProfile(raw: UserProfileWire): UserProfile {
  const g = raw.gamification;
  const gamification: GamificationState = {
    unlockedBadgeIds: g.unlockedBadgeIds ?? [],
    currentStreakDays: g.currentStreakDays ?? 0,
    longestStreakDays: g.longestStreakDays ?? 0,
    lastChargeDay: g.lastChargeDay ?? null,
    weeklyPoints: g.weeklyPoints ?? 0,
    weekKey: g.weekKey ?? null,
    completedChallengeIds: g.completedChallengeIds ?? [],
    uniqueStationsCharged: g.uniqueStationsCharged ?? [],
    sessionsThisWeek: g.sessionsThisWeek ?? 0,
    stationsThisWeek: g.stationsThisWeek ?? [],
    reportsSubmitted: g.reportsSubmitted ?? 0,
  };

  const profile: UserProfile = {
    id: raw.id,
    email: raw.email,
    passwordHash: raw.passwordHash ?? '',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    phone: raw.phone ?? '',
    memberSince: raw.memberSince ?? '',
    membershipId: raw.membershipId ?? '',
    loyaltyPoints: raw.loyaltyPoints ?? 0,
    loyaltyTier: asLoyaltyTier(String(raw.loyaltyTier ?? 'bronze')),
    totalKwh: raw.totalKwh ?? 0,
    totalSessions: raw.totalSessions ?? 0,
    co2SavedKg: raw.co2SavedKg ?? 0,
    vehicles: (raw.vehicles ?? []).map((v) => ({
      id: v.id,
      nickname: v.nickname ?? '',
      brand: v.brand ?? '',
      model: v.model ?? '',
      batteryKwh: v.batteryKwh ?? 0,
      maxAcKw: v.maxAcKw ?? 0,
      maxDcKw: v.maxDcKw ?? 0,
      preferredConnector: asConnectorType(String(v.preferredConnector ?? 'Type2')),
      licensePlate: v.licensePlate ?? '',
    })),
    paymentMethods: (raw.paymentMethods ?? []).map((pm) => ({
      id: pm.id,
      type:
        pm.type === 'card' || pm.type === 'sepa' || pm.type === 'paypal'
          ? pm.type
          : 'card',
      label: pm.label ?? '',
      last4: pm.last4,
      isDefault: Boolean(pm.isDefault),
      expiry: pm.expiry,
      stripePaymentMethodId: pm.stripePaymentMethodId,
    })),
    favoriteStationIds: raw.favoriteStationIds ?? [],
    notifications: {
      sessionComplete: raw.notifications?.sessionComplete ?? true,
      promotions: raw.notifications?.promotions ?? false,
      stationAvailability: raw.notifications?.stationAvailability ?? false,
      loyaltyUpdates: raw.notifications?.loyaltyUpdates ?? true,
    },
    chargingPlan: {
      enabled: raw.chargingPlan?.enabled ?? true,
      snoozedUntil: raw.chargingPlan?.snoozedUntil ?? null,
      expandedOnHome: raw.chargingPlan?.expandedOnHome ?? false,
    },
    gamification,
  };

  if (raw.stripeCustomerId !== undefined) profile.stripeCustomerId = raw.stripeCustomerId;
  if (raw.privacyConsentAt !== undefined) profile.privacyConsentAt = raw.privacyConsentAt;
  if (raw.termsAcceptedAt !== undefined) profile.termsAcceptedAt = raw.termsAcceptedAt;
  if (raw.marketingConsentAt !== undefined) profile.marketingConsentAt = raw.marketingConsentAt;
  if (raw.prioritySupportUntil !== undefined) {
    profile.prioritySupportUntil = raw.prioritySupportUntil;
  }
  return profile;
}

export function toChargingSession(raw: ChargingSessionWire): ChargingSession {
  const session: ChargingSession = {
    id: raw.id,
    stationId: raw.stationId,
    stationName: raw.stationName ?? '',
    connectorId: raw.connectorId,
    connectorType: asConnectorType(String(raw.connectorType ?? 'Type2')),
    powerKw: raw.powerKw ?? 0,
    vehicleId: raw.vehicleId ?? '',
    paymentMethodId: raw.paymentMethodId ?? '',
    startedAt: raw.startedAt,
    status: asSessionStatus(String(raw.status)),
    energyKwh: raw.energyKwh ?? 0,
    costEur: raw.costEur ?? 0,
    pricePerKwh: raw.pricePerKwh ?? 0,
    sessionFee: raw.sessionFee ?? 0,
    pointsEarned: raw.pointsEarned ?? 0,
  };

  if (raw.endedAt !== undefined) session.endedAt = raw.endedAt;
  if (raw.citrineosTransactionId !== undefined) {
    session.citrineosTransactionId = raw.citrineosTransactionId;
  }
  if (raw.citrineosStationDbId !== undefined) {
    session.citrineosStationDbId = raw.citrineosStationDbId;
  }
  if (raw.remoteStartId !== undefined) session.remoteStartId = raw.remoteStartId;
  if (raw.citrineosBacked !== undefined) session.citrineosBacked = raw.citrineosBacked;
  if (raw.stripePaymentIntentId !== undefined) {
    session.stripePaymentIntentId = raw.stripePaymentIntentId;
  }
  const paymentStatus = asPaymentStatus(
    raw.paymentStatus == null ? undefined : String(raw.paymentStatus)
  );
  if (paymentStatus !== undefined) session.paymentStatus = paymentStatus;
  if (raw.invoiceNumber !== undefined) session.invoiceNumber = raw.invoiceNumber;
  if (raw.invoiceEmailedAt !== undefined) session.invoiceEmailedAt = raw.invoiceEmailedAt;
  if (raw.midCertified !== undefined) session.midCertified = raw.midCertified;
  if (raw.chargePointModel !== undefined) session.chargePointModel = raw.chargePointModel;
  if (raw.evseNumber !== undefined) session.evseNumber = raw.evseNumber;
  if (raw.chargingState !== undefined) session.chargingState = raw.chargingState;
  if (raw.appliedFulfillmentId !== undefined) {
    session.appliedFulfillmentId = raw.appliedFulfillmentId;
  }
  if (raw.baseCostEur !== undefined) session.baseCostEur = raw.baseCostEur;
  if (raw.rewardDiscountEur !== undefined) session.rewardDiscountEur = raw.rewardDiscountEur;
  if (raw.rewardLabel !== undefined) session.rewardLabel = raw.rewardLabel;
  if (raw.pricePerMin !== undefined) session.pricePerMin = raw.pricePerMin;
  if (raw.currency !== undefined) session.currency = raw.currency;
  if (raw.tariffSnapshotId !== undefined) session.tariffSnapshotId = raw.tariffSnapshotId;
  if (raw.tariffSnapshotHash !== undefined) session.tariffSnapshotHash = raw.tariffSnapshotHash;
  if (raw.tariffVersionId !== undefined) session.tariffVersionId = raw.tariffVersionId;
  return session;
}

export function toRewardFulfillment(raw: RewardFulfillmentWire): RewardFulfillment {
  const type = raw.type as RewardFulfillment['type'];
  const status =
    raw.status === 'active' || raw.status === 'used' || raw.status === 'expired'
      ? raw.status
      : 'active';
  return {
    id: raw.id,
    userId: raw.userId,
    rewardId: raw.rewardId,
    type,
    status,
    payload: raw.payload ?? {},
    redeemedAt: raw.redeemedAt ?? '',
    expiresAt: raw.expiresAt ?? null,
    usedAt: raw.usedAt ?? null,
    sessionId: raw.sessionId ?? null,
    isActive: raw.isActive,
  };
}
