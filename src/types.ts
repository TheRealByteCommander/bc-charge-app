import type { GamificationState } from './types/gamification';

export type ConnectorType = 'CCS' | 'Type2' | 'CHAdeMO';
export type ConnectorStatus = 'available' | 'occupied' | 'offline' | 'reserved';

export interface Connector {
  id: string;
  type: ConnectorType;
  powerKw: number;
  status: ConnectorStatus;
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
  remoteStartId?: number;
  /** true = Live-Daten von CitrineOS, false = lokale Simulation */
  citrineosBacked?: boolean;
  stripePaymentIntentId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'skipped';
  /** Rechnungsnummer (z. B. BC-2026-123456) */
  invoiceNumber?: string;
  /** Zeitpunkt des E-Mail-Versands der Rechnung (ISO) */
  invoiceEmailedAt?: string | null;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
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
