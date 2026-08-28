import { describe, expect, it } from 'vitest';
import { defaultChargingPlan } from '../data/chargingPlan';
import { defaultGamification } from '../services/gamification';
import type { UserProfile } from '../types';
import {
  chargingPlanPrefsEqual,
  isProfilePatchNoop,
  notificationPrefsEqual,
} from './profilePatchEqual';

const baseNotifications = {
  sessionComplete: true,
  promotions: false,
  stationAvailability: true,
  loyaltyUpdates: false,
};

function baseUser(over: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    email: 'a@b.c',
    passwordHash: 'x',
    firstName: 'A',
    lastName: 'B',
    phone: '',
    memberSince: '2026-01-01',
    membershipId: 'm1',
    loyaltyPoints: 0,
    loyaltyTier: 'bronze',
    totalKwh: 0,
    totalSessions: 0,
    co2SavedKg: 0,
    vehicles: [],
    paymentMethods: [],
    favoriteStationIds: ['st-1'],
    notifications: { ...baseNotifications },
    chargingPlan: defaultChargingPlan(),
    gamification: defaultGamification(),
    stripeCustomerId: 'cus_1',
    ...over,
  };
}

describe('notificationPrefsEqual', () => {
  it('returns true for identical snapshots', () => {
    expect(notificationPrefsEqual(baseNotifications, { ...baseNotifications })).toBe(true);
  });

  it('returns false when any flag differs', () => {
    expect(
      notificationPrefsEqual(baseNotifications, { ...baseNotifications, promotions: true })
    ).toBe(false);
    expect(
      notificationPrefsEqual(baseNotifications, {
        ...baseNotifications,
        sessionComplete: false,
      })
    ).toBe(false);
  });

  it('returns false for nullish mismatch', () => {
    expect(notificationPrefsEqual(baseNotifications, null)).toBe(false);
    expect(notificationPrefsEqual(undefined, baseNotifications)).toBe(false);
  });
});

describe('chargingPlanPrefsEqual', () => {
  it('treats default-equivalent partials as equal', () => {
    expect(chargingPlanPrefsEqual(defaultChargingPlan(), {})).toBe(true);
    expect(chargingPlanPrefsEqual({ enabled: true }, defaultChargingPlan())).toBe(true);
  });

  it('returns false when fields differ', () => {
    expect(
      chargingPlanPrefsEqual(defaultChargingPlan(), {
        ...defaultChargingPlan(),
        expandedOnHome: false,
      })
    ).toBe(false);
    expect(
      chargingPlanPrefsEqual(defaultChargingPlan(), {
        ...defaultChargingPlan(),
        snoozedUntil: '2099-01-01T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('isProfilePatchNoop', () => {
  it('no-ops empty patch', () => {
    expect(isProfilePatchNoop(baseUser(), {})).toBe(true);
  });

  it('no-ops identical notification prefs (new object identity)', () => {
    const user = baseUser();
    expect(
      isProfilePatchNoop(user, {
        notifications: { ...user.notifications },
      })
    ).toBe(true);
  });

  it('detects notification toggle change', () => {
    const user = baseUser();
    expect(
      isProfilePatchNoop(user, {
        notifications: { ...user.notifications, loyaltyUpdates: true },
      })
    ).toBe(false);
  });

  it('no-ops identical chargingPlan and stripeCustomerId', () => {
    const user = baseUser();
    expect(
      isProfilePatchNoop(user, {
        chargingPlan: { ...user.chargingPlan },
        stripeCustomerId: 'cus_1',
      })
    ).toBe(true);
  });

  it('detects favorite list change and scalar change', () => {
    const user = baseUser();
    expect(isProfilePatchNoop(user, { favoriteStationIds: ['st-1'] })).toBe(true);
    expect(isProfilePatchNoop(user, { favoriteStationIds: ['st-1', 'st-2'] })).toBe(false);
    expect(isProfilePatchNoop(user, { stripeCustomerId: 'cus_2' })).toBe(false);
    expect(isProfilePatchNoop(user, { firstName: 'Z' })).toBe(false);
  });
});
