import { describe, expect, it } from 'vitest';
import {
  AuthUserEnvelopeSchema,
  ChargingSessionSchema,
  SessionCompleteEnvelopeSchema,
  SessionEnvelopeSchema,
  SessionsListEnvelopeSchema,
  toChargingSession,
  toUserProfile,
  UserProfileSchema,
} from './schemas';

const minimalUser = {
  id: 'user_1',
  email: 'a@b.de',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '',
  memberSince: '2026-01-01T00:00:00.000Z',
  membershipId: 'BC-1000A',
  loyaltyPoints: 250,
  loyaltyTier: 'bronze',
  totalKwh: 0,
  totalSessions: 0,
  co2SavedKg: 0,
  vehicles: [],
  paymentMethods: [],
  favoriteStationIds: [],
  notifications: {
    sessionComplete: true,
    promotions: false,
    stationAvailability: false,
    loyaltyUpdates: true,
  },
  chargingPlan: { enabled: true, snoozedUntil: null, expandedOnHome: false },
  gamification: {
    unlockedBadgeIds: [],
    currentStreakDays: 0,
    longestStreakDays: 0,
    lastChargeDay: null,
    weeklyPoints: 0,
    weekKey: null,
    completedChallengeIds: [],
    uniqueStationsCharged: [],
    sessionsThisWeek: 0,
    stationsThisWeek: [],
    reportsSubmitted: 0,
  },
  passwordHash: '',
};

const minimalSession = {
  id: 'sess_1',
  stationId: 'st-1',
  stationName: 'Hof',
  connectorId: 'c1',
  connectorType: 'CCS',
  powerKw: 22,
  vehicleId: 'v1',
  paymentMethodId: 'pm1',
  startedAt: '2026-08-15T06:00:00.000Z',
  status: 'active',
  energyKwh: '3.5',
  costEur: 1.2,
  pricePerKwh: 0.39,
  sessionFee: 0,
  pointsEarned: 0,
  chargingState: 'Charging',
};

describe('UserProfileSchema / AuthUserEnvelope', () => {
  it('parses full auth envelope and maps domain user', () => {
    const parsed = AuthUserEnvelopeSchema.parse({ user: minimalUser });
    const user = toUserProfile(parsed.user);
    expect(user.id).toBe('user_1');
    expect(user.email).toBe('a@b.de');
    expect(user.loyaltyTier).toBe('bronze');
    expect(user.passwordHash).toBe('');
    expect(user.gamification.currentStreakDays).toBe(0);
  });

  it('coerces numeric strings and fills nested defaults', () => {
    const parsed = UserProfileSchema.parse({
      id: 'u2',
      email: 'x@y.z',
      loyaltyPoints: '12',
      totalKwh: '4.5',
    });
    const user = toUserProfile(parsed);
    expect(user.loyaltyPoints).toBe(12);
    expect(user.totalKwh).toBe(4.5);
    expect(user.notifications.sessionComplete).toBe(true);
    expect(user.chargingPlan.enabled).toBe(true);
    expect(user.vehicles).toEqual([]);
  });

  it('rejects missing identity', () => {
    expect(() => UserProfileSchema.parse({ email: 'a@b.de' })).toThrow();
    expect(() => AuthUserEnvelopeSchema.parse({ user: { id: 'x' } })).toThrow();
  });
});

describe('ChargingSessionSchema / session envelopes', () => {
  it('coerces energy/cost numbers and maps session', () => {
    const s = toChargingSession(ChargingSessionSchema.parse(minimalSession));
    expect(s.energyKwh).toBe(3.5);
    expect(s.costEur).toBe(1.2);
    expect(s.connectorType).toBe('CCS');
    expect(s.status).toBe('active');
    expect(s.chargingState).toBe('Charging');
  });

  it('parses list + nullable active envelopes', () => {
    const list = SessionsListEnvelopeSchema.parse({ sessions: [minimalSession] });
    expect(list.sessions).toHaveLength(1);
    expect(toChargingSession(list.sessions[0]).id).toBe('sess_1');

    const active = SessionEnvelopeSchema.parse({ session: null });
    expect(active.session).toBeNull();

    const withSession = SessionEnvelopeSchema.parse({ session: minimalSession });
    expect(withSession.session?.id).toBe('sess_1');
  });

  it('parses complete envelope with optional invoice', () => {
    const complete = SessionCompleteEnvelopeSchema.parse({
      session: { ...minimalSession, status: 'completed', endedAt: '2026-08-15T07:00:00.000Z' },
      user: minimalUser,
      invoice: { invoiceNumber: 'BC-2026-1', emailSent: true },
    });
    expect(toChargingSession(complete.session).status).toBe('completed');
    expect(toUserProfile(complete.user).membershipId).toBe('BC-1000A');
    expect(complete.invoice?.invoiceNumber).toBe('BC-2026-1');
  });

  it('rejects session without id/station', () => {
    expect(() => ChargingSessionSchema.parse({ id: 'x', status: 'active' })).toThrow();
  });
});
