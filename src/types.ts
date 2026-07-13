import type { GamificationState } from './types/gamification';

export type ConnectorType = 'CCS' | 'Type2' | 'CHAdeMO';
export type ConnectorStatus = 'available' | 'occupied' | 'offline' | 'reserved';

/** Bekannte Hardware-Modelle mit spezifischen Features */
export type KnownHardwareModel = 'CityCharge H2' | 'generic';

/** Hardware-Features für spezifische Ladepunkt-Modelle */
export interface HardwareFeatures {
  /** MID-zertifizierte Zähler (Eichrecht-konform) */
  midCertifiedMeters: boolean;
  /** Dynamisches Lastmanagement aktiv */
  dynamicLoadManagement: boolean;
  /** OCPP-Version der Hardware (CitrineOS übersetzt ggf.) */
  ocppVersion: '1.6' | '2.0.1';
  /** Multi-Connector-Support (mehr als 1 EVSE) */
  multiConnector: boolean;
}

export interface Connector {
  id: string;
  type: ConnectorType;
  powerKw: number;
  status: ConnectorStatus;
  /** Rohstatus aus CitrineOS/OCPP (z. B. Preparing, Charging) */
  ocppRawStatus?: string;
  evseId: string;
  pricePerKwh: number;
  pricePerMin?: number;
  sessionFee?: number;
  /** ISO-4217, z. B. EUR aus CitrineOS */
  currency?: string;
  /** CitrineOS-Tarif-ID */
  tariffId?: number;
  /** Preis aus CitrineOS (Hasura/REST), nicht Demo */
  livePricing?: boolean;
  /** false = Tarif in CitrineOS fehlt oder unvollständig */
  priceKnown?: boolean;
  /** Numerische EVSE-ID für Multi-Connector-Anzeige (z.B. 1, 2) */
  evseNumber?: number;
  /** Numerische Connector-ID innerhalb des EVSE */
  connectorNumber?: number;
}

export interface Station {
  id: string;
  evseCode: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  amenities: string[];
  openingHours: string;
  operator: 'BC Charge';
  network: string;
  rating: number;
  reviewCount: number;
  imageGradient: string;
  connectors: Connector[];
  greenEnergy: boolean;
  accessible: boolean;
  /** Hardware-Hersteller (z.B. "Elinta Charge") */
  chargePointVendor?: string;
  /** Hardware-Modell (z.B. "CityCharge H2") */
  chargePointModel?: string;
  /** Erkanntes Hardware-Modell für Feature-Flags */
  hardwareModel?: KnownHardwareModel;
  /** Hardware-spezifische Features */
  hardwareFeatures?: HardwareFeatures;
  /** Numerische ChargingStations.id in CitrineOS/Hasura (Transactions.stationId) */
  citrineosDatabaseId?: number;
}

export interface Vehicle {
  id: string;
  nickname: string;
  brand: string;
  model: string;
  batteryKwh: number;
  maxAcKw: number;
  maxDcKw: number;
  preferredConnector: ConnectorType;
  licensePlate: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'sepa' | 'paypal';
  label: string;
  last4?: string;
  isDefault: boolean;
  expiry?: string;
  /** Stripe PaymentMethod-ID (pm_…) */
  stripePaymentMethodId?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  memberSince: string;
  membershipId: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  totalKwh: number;
  totalSessions: number;
  co2SavedKg: number;
  vehicles: Vehicle[];
  paymentMethods: PaymentMethod[];
  favoriteStationIds: string[];
  notifications: NotificationPrefs;
  chargingPlan: ChargingPlanPrefs;
  gamification: GamificationState;
  /** Stripe Customer-ID (cus_…) */
  stripeCustomerId?: string;
  /** Zeitpunkt der Einwilligung in Datenschutzerklärung (ISO) */
  privacyConsentAt?: string;
  /** Zeitpunkt der AGB-Zustimmung (ISO) */
  termsAcceptedAt?: string;
  /** Marketing-Einwilligung (ISO), nur wenn erteilt */
  marketingConsentAt?: string | null;
  /** Priority Support aktiv bis (ISO) */
  prioritySupportUntil?: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface NotificationPrefs {
  sessionComplete: boolean;
  promotions: boolean;
  stationAvailability: boolean;
  loyaltyUpdates: boolean;
}

/** Einstellungen für die Empfehlung der nächsten freien Station. */
export interface ChargingPlanPrefs {
  /** Empfehlungen ein/aus */
  enabled: boolean;
  /** Bis zu diesem Zeitpunkt kein Hinweis auf der Startseite */
  snoozedUntil: string | null;
  /** Karte auf Startseite aufgeklappt */
  expandedOnHome: boolean;
}

export interface ChargingSession {
  id: string;
  stationId: string;
  stationName: string;
  connectorId: string;
  connectorType: ConnectorType;
  powerKw: number;
  vehicleId: string;
  paymentMethodId: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'cancelled';
  energyKwh: number;
  costEur: number;
  pricePerKwh: number;
  sessionFee: number;
  pointsEarned: number;
  /** CitrineOS/OCPP Transaktions-ID */
  citrineosTransactionId?: string;
  /** CitrineOS ChargingStations.id (Hasura) – für Live-Polling ohne Stations-Cache */
  citrineosStationDbId?: number;
  remoteStartId?: number;
  /** true = Live-Daten von CitrineOS, false = lokale Simulation */
  citrineosBacked?: boolean;
  stripePaymentIntentId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'skipped';
  /** Rechnungsnummer (z. B. BC-2026-123456) */
  invoiceNumber?: string;
  /** Zeitpunkt des E-Mail-Versands der Rechnung (ISO) */
  invoiceEmailedAt?: string | null;
  /** MID-zertifizierte Messung (Eichrecht-konform) */
  midCertified?: boolean;
  /** Hardware-Modell der Ladestation */
  chargePointModel?: string;
  /** EVSE-Nummer (für Multi-Connector-Stationen) */
  evseNumber?: number;
  /** OCPP Charging State (Idle, EVConnected, Charging, SuspendedEVSE, SuspendedEV) */
  chargingState?: string | null;
  /** Angewendete Prämie (Fulfillment-ID) */
  appliedFulfillmentId?: string;
  /** Kosten vor Prämienrabatt */
  baseCostEur?: number;
  /** Rabatt durch Prämie in EUR */
  rewardDiscountEur?: number;
  /** Anzeige-Label der Prämie */
  rewardLabel?: string;
  pricePerMin?: number;
}

export type RewardFulfillmentType =
  | 'voucher'
  | 'energy_discount'
  | 'free_kwh'
  | 'night_points'
  | 'priority_support';

export interface RewardFulfillment {
  id: string;
  userId: string;
  rewardId: string;
  type: RewardFulfillmentType;
  status: 'active' | 'used' | 'expired';
  payload: Record<string, unknown>;
  redeemedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  sessionId: string | null;
  isActive?: boolean;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  pointsCost: number;
  category: 'charging' | 'partner' | 'exclusive';
  available: boolean;
}

export interface SessionReceipt {
  session: ChargingSession;
  invoiceNumber: string;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
}
