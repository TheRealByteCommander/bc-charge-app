import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearActiveSessionCache,
  parseActiveSessionCache,
  saveActiveSessionCache,
} from './storage';
import type { ChargingSession } from '../types';

const userId = 'user_1';

const activeSession = {
  id: 'sess_1',
  stationId: 'st-1',
  stationName: 'Hof',
  connectorId: 'c1',
  connectorType: 'CCS',
  powerKw: 22,
  vehicleId: 'v1',
  paymentMethodId: 'pm1',
  startedAt: '2026-08-18T06:00:00.000Z',
  status: 'active',
  energyKwh: '3.5',
  costEur: 1.2,
  pricePerKwh: 0.39,
  sessionFee: 0,
  pointsEarned: 0,
  chargingState: 'Charging',
  citrineosTransactionId: 'tx-99',
};

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    userId,
    session: activeSession,
    savedAt: '2026-08-18T06:05:00.000Z',
    ...overrides,
  });
}

describe('parseActiveSessionCache', () => {
  it('maps a well-formed active envelope to a domain session', () => {
    const session = parseActiveSessionCache(envelope(), userId);
    expect(session).not.toBeNull();
    expect(session!.id).toBe('sess_1');
    expect(session!.stationId).toBe('st-1');
    expect(session!.status).toBe('active');
    expect(session!.energyKwh).toBe(3.5);
    expect(session!.citrineosTransactionId).toBe('tx-99');
    expect(session!.chargingState).toBe('Charging');
  });

  it('rejects empty userId, missing raw, invalid JSON, and non-objects', () => {
    expect(parseActiveSessionCache(envelope(), '')).toBeNull();
    expect(parseActiveSessionCache(null, userId)).toBeNull();
    expect(parseActiveSessionCache('', userId)).toBeNull();
    expect(parseActiveSessionCache('{', userId)).toBeNull();
    expect(parseActiveSessionCache('[]', userId)).toBeNull();
    expect(parseActiveSessionCache('"x"', userId)).toBeNull();
  });

  it('rejects wrong user and non-active status', () => {
    expect(parseActiveSessionCache(envelope(), 'other-user')).toBeNull();
    expect(
      parseActiveSessionCache(
        envelope({ session: { ...activeSession, status: 'completed' } }),
        userId
      )
    ).toBeNull();
    expect(
      parseActiveSessionCache(
        envelope({ session: { ...activeSession, status: 'cancelled' } }),
        userId
      )
    ).toBeNull();
  });

  it('rejects partial / corrupt session payloads (parse-dont-cast)', () => {
    expect(parseActiveSessionCache(envelope({ session: null }), userId)).toBeNull();
    expect(parseActiveSessionCache(envelope({ session: 'nope' }), userId)).toBeNull();
    expect(parseActiveSessionCache(envelope({ session: [] }), userId)).toBeNull();
    expect(
      parseActiveSessionCache(
        envelope({ session: { ...activeSession, id: '' } }),
        userId
      )
    ).toBeNull();
    expect(
      parseActiveSessionCache(
        envelope({
          session: {
            id: 'sess_1',
            status: 'active',
            // missing stationId / connectorId / startedAt
          },
        }),
        userId
      )
    ).toBeNull();
    expect(
      parseActiveSessionCache(
        envelope({
          session: { ...activeSession, energyKwh: 'not-a-number' },
        }),
        userId
      )
    ).toBeNull();
  });
});

const domainActiveSession = {
  id: 'sess_1',
  stationId: 'st-1',
  stationName: 'Hof',
  connectorId: 'c1',
  connectorType: 'CCS',
  powerKw: 22,
  vehicleId: 'v1',
  paymentMethodId: 'pm1',
  startedAt: '2026-08-18T06:00:00.000Z',
  status: 'active' as const,
  energyKwh: 3.5,
  costEur: 1.2,
  pricePerKwh: 0.39,
  sessionFee: 0,
  pointsEarned: 0,
  chargingState: 'Charging' as const,
  citrineosTransactionId: 'tx-99',
} satisfies ChargingSession;

describe('saveActiveSessionCache', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes envelope on first save and skips rewrite when live metrics are equal', () => {
    saveActiveSessionCache(userId, domainActiveSession);
    expect(store.size).toBe(1);
    const firstRaw = [...store.values()][0];
    const first = JSON.parse(firstRaw) as { savedAt: string; session: { energyKwh: number } };
    expect(first.session.energyKwh).toBe(3.5);

    // Identical metrics must not touch sessionStorage (savedAt would otherwise churn).
    saveActiveSessionCache(userId, { ...domainActiveSession });
    expect([...store.values()][0]).toBe(firstRaw);

    // Meter change must rewrite.
    saveActiveSessionCache(userId, { ...domainActiveSession, energyKwh: 4.1 });
    const secondRaw = [...store.values()][0];
    expect(secondRaw).not.toBe(firstRaw);
    const second = JSON.parse(secondRaw) as { session: { energyKwh: number } };
    expect(second.session.energyKwh).toBe(4.1);
  });

  it('clearActiveSessionCache removes the resume key', () => {
    saveActiveSessionCache(userId, domainActiveSession);
    expect(store.size).toBe(1);
    clearActiveSessionCache();
    expect(store.size).toBe(0);
  });
});
