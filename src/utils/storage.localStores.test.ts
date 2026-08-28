import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadFulfillments,
  loadRedeemed,
  loadSessions,
  loadUsers,
  parseStoredFulfillments,
  parseStoredRedeemedIds,
  parseStoredSessions,
  parseStoredUsers,
  saveFulfillments,
  saveRedeemed,
  saveSessions,
  saveUsers,
  storedSessionsDomainEqual,
  storedStringIdsEqual,
} from './storage';
import type { ChargingSession, RewardFulfillment, UserProfile } from '../types';

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

describe('storedSessionsDomainEqual / storedStringIdsEqual', () => {
  it('compares session lists by domain fields (order-sensitive)', () => {
    const a = parseStoredSessions([validSession]);
    const b = parseStoredSessions([validSession]);
    expect(storedSessionsDomainEqual(a, b)).toBe(true);
    expect(
      storedSessionsDomainEqual(a, parseStoredSessions([{ ...validSession, energyKwh: '4' }]))
    ).toBe(false);
    expect(
      storedSessionsDomainEqual(a, parseStoredSessions([{ ...validSession, startedAt: 'x' }]))
    ).toBe(false);
  });

  it('compares redeemed id lists order-sensitively', () => {
    expect(storedStringIdsEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(storedStringIdsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(storedStringIdsEqual(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('local demo save* equal-skip', () => {
  let store: Map<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    setItem = vi.fn((key: string, value: string) => {
      store.set(key, value);
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem,
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saveUsers skips rewrite when profile snapshot is unchanged', () => {
    const users = parseStoredUsers(JSON.stringify([validUser])) as UserProfile[];
    saveUsers(users);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveUsers(users.map((u) => ({ ...u })));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(loadUsers()).toHaveLength(1);

    saveUsers([{ ...users[0], loyaltyPoints: users[0].loyaltyPoints + 1 }]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('saveSessions skips rewrite when domain list is unchanged', () => {
    const sessions = parseStoredSessions([validSession]) as ChargingSession[];
    saveSessions('user_1', sessions);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveSessions('user_1', sessions.map((s) => ({ ...s })));
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(loadSessions('user_1')).toHaveLength(1);

    saveSessions('user_1', [{ ...sessions[0], energyKwh: sessions[0].energyKwh + 0.1 }]);
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('saveRedeemed / saveFulfillments skip identical payloads', () => {
    saveRedeemed('user_1', ['rw_1', 'rw_2']);
    expect(setItem).toHaveBeenCalledTimes(1);
    saveRedeemed('user_1', ['rw_1', 'rw_2']);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(loadRedeemed('user_1')).toEqual(['rw_1', 'rw_2']);

    const ffs = parseStoredFulfillments([validFulfillment]) as RewardFulfillment[];
    saveFulfillments('user_1', ffs);
    expect(setItem).toHaveBeenCalledTimes(2);
    saveFulfillments(
      'user_1',
      ffs.map((f) => ({ ...f, payload: { ...f.payload } }))
    );
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(loadFulfillments('user_1')).toHaveLength(1);

    saveFulfillments('user_1', [{ ...ffs[0], status: 'used' }]);
    expect(setItem).toHaveBeenCalledTimes(3);
  });
});
