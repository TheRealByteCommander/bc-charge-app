import { describe, expect, it } from 'vitest';
import {
  parseStoredFulfillments,
  parseStoredRedeemedIds,
  parseStoredSessions,
  parseStoredUsers,
} from './storage';

const validUser = {
  id: 'user_1',
  email: 'a@b.c',
  firstName: 'Ada',
  lastName: 'Lovelace',
  loyaltyPoints: '42',
  loyaltyTier: 'gold',
  totalKwh: 12.5,
  totalSessions: 3,
  vehicles: [
    {
      id: 'v1',
      nickname: 'Leaf',
      brand: 'Nissan',
      model: 'Leaf',
      batteryKwh: 40,
      maxAcKw: 6.6,
      maxDcKw: 50,
      preferredConnector: 'CCS',
    },
  ],
  paymentMethods: [
    {
      id: 'pm1',
      type: 'card',
      label: 'Visa',
      last4: '4242',
      isDefault: true,
    },
  ],
  favoriteStationIds: ['st-1'],
  notifications: { sessionComplete: true },
  chargingPlan: { enabled: true },
  gamification: { currentStreakDays: 2, unlockedBadgeIds: ['b1'] },
};

const validSession = {
  id: 'sess_1',
  stationId: 'st-1',
  stationName: 'Hof',
  connectorId: 'c1',
  connectorType: 'CCS',
  powerKw: '22',
  vehicleId: 'v1',
  paymentMethodId: 'pm1',
  startedAt: '2026-08-19T06:00:00.000Z',
  status: 'completed',
  energyKwh: '3.5',
  costEur: 1.2,
  pricePerKwh: 0.39,
  sessionFee: 0,
  pointsEarned: 5,
  chargingState: 'Idle',
};

const validFulfillment = {
  id: 'ff_1',
  userId: 'user_1',
  rewardId: 'rw_1',
  type: 'discount_percent',
  status: 'active',
  payload: { percent: 10 },
  redeemedAt: '2026-08-19T05:00:00.000Z',
  expiresAt: null,
  usedAt: null,
  sessionId: null,
};

describe('parseStoredUsers', () => {
  it('maps well-formed users and coerces numeric strings', () => {
    const users = parseStoredUsers(JSON.stringify([validUser]));
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user_1');
    expect(users[0].email).toBe('a@b.c');
    expect(users[0].loyaltyPoints).toBe(42);
    expect(users[0].loyaltyTier).toBe('gold');
    expect(users[0].vehicles[0]?.preferredConnector).toBe('CCS');
    expect(users[0].gamification.currentStreakDays).toBe(2);
  });

  it('drops corrupt / partial rows and non-arrays (parse-dont-cast)', () => {
    expect(parseStoredUsers(null)).toEqual([]);
    expect(parseStoredUsers('')).toEqual([]);
    expect(parseStoredUsers('{')).toEqual([]);
    expect(parseStoredUsers('{}')).toEqual([]);
    expect(parseStoredUsers('"x"')).toEqual([]);
    expect(
      parseStoredUsers(
        JSON.stringify([
          validUser,
          null,
          'nope',
          { email: 'missing-id@x' },
          { id: '', email: 'x@y.z' },
          { id: 'u2' }, // missing email
        ])
      )
    ).toHaveLength(1);
  });
});

describe('parseStoredSessions', () => {
  it('maps well-formed sessions and coerces energy/cost', () => {
    const sessions = parseStoredSessions([validSession]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('sess_1');
    expect(sessions[0].energyKwh).toBe(3.5);
    expect(sessions[0].powerKw).toBe(22);
    expect(sessions[0].status).toBe('completed');
    expect(sessions[0].chargingState).toBe('Idle');
  });

  it('drops invalid rows and non-arrays', () => {
    expect(parseStoredSessions(null)).toEqual([]);
    expect(parseStoredSessions({})).toEqual([]);
    expect(
      parseStoredSessions([
        validSession,
        { id: 'x' },
        { ...validSession, id: '' },
        { ...validSession, energyKwh: 'NaN-ish' },
        'bad',
      ])
    ).toHaveLength(1);
  });
});

describe('parseStoredFulfillments + redeemed ids', () => {
  it('maps fulfillments and keeps only string/number reward ids', () => {
    const ffs = parseStoredFulfillments([validFulfillment, { id: 'x' }, null]);
    expect(ffs).toHaveLength(1);
    expect(ffs[0].id).toBe('ff_1');
    expect(ffs[0].type).toBe('discount_percent');
    expect(ffs[0].status).toBe('active');
    expect(ffs[0].payload).toEqual({ percent: 10 });

    expect(parseStoredRedeemedIds(['a', '', 12, null, {}, 'b'])).toEqual(['a', '12', 'b']);
    expect(parseStoredRedeemedIds(null)).toEqual([]);
  });
});
