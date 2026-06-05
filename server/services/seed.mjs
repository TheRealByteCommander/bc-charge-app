import { findUserByEmail, insertUser } from '../db.mjs';
import { hashPassword } from '../auth/password.mjs';

export async function seedDemoUser() {
  if (process.env.BC_SEED_DEMO === 'false') return;
  const email = 'demo@bc-charge.com';
  if (await findUserByEmail(email)) return;

  const now = new Date().toISOString();
  const profile = {
    firstName: 'Anna',
    lastName: 'Schneider',
    phone: '+49 34292 43340',
    memberSince: '2024-03-15T10:00:00.000Z',
    membershipId: 'BC-DEMO2847',
    loyaltyPoints: 2180,
    loyaltyTier: 'silver',
    totalKwh: 486.4,
    totalSessions: 34,
    co2SavedKg: 312,
    favoriteStationIds: ['st-machern-markt', 'st-leipzig-plagwitz'],
    notifications: {
      sessionComplete: true,
      promotions: false,
      stationAvailability: true,
      loyaltyUpdates: true,
    },
    chargingPlan: {
      enabled: true,
      snoozedUntil: null,
      expandedOnHome: false,
    },
    gamification: {
      unlockedBadgeIds: ['first_charge', 'silver_tier', 'explorer', 'community'],
      currentStreakDays: 4,
      longestStreakDays: 8,
      lastChargeDay: new Date().toISOString().slice(0, 10),
      weeklyPoints: 420,
      weekKey: null,
      sessionsThisWeek: 2,
      stationsThisWeek: ['st-machern-markt', 'st-leipzig-plagwitz'],
      uniqueStationsCharged: ['st-machern-markt', 'st-leipzig-plagwitz', 'st-grimma-center', 'st-borna-sued'],
      reportsSubmitted: 1,
      completedChallengeIds: [],
    },
    vehicles: [
      {
        id: 'v1',
        nickname: 'Alltags-PKW',
        brand: 'VW',
        model: 'ID.4 Pro',
        batteryKwh: 77,
        maxAcKw: 11,
        maxDcKw: 135,
        preferredConnector: 'CCS',
        licensePlate: 'L-BC 404E',
      },
    ],
    paymentMethods: [],
    privacyConsentAt: now,
    termsAcceptedAt: now,
    marketingConsentAt: null,
  };

  await insertUser({
    id: 'user_demo_bc',
    email,
    passwordHash: hashPassword('demo123'),
    profile,
  });
}
