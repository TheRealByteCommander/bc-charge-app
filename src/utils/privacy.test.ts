import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const memoryLocal = new Map<string, string>();
const memorySession = new Map<string, string>();

function installStorageMocks() {
  memoryLocal.clear();
  memorySession.clear();
  const localStorageMock = {
    getItem: (k: string) => memoryLocal.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryLocal.set(k, String(v));
    },
    removeItem: (k: string) => {
      memoryLocal.delete(k);
    },
    clear: () => memoryLocal.clear(),
  };
  const sessionStorageMock = {
    getItem: (k: string) => memorySession.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memorySession.set(k, String(v));
    },
    removeItem: (k: string) => {
      memorySession.delete(k);
    },
    clear: () => memorySession.clear(),
  };
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('sessionStorage', sessionStorageMock);
}

describe('privacy purge + export (Art. 17/20)', () => {
  beforeEach(() => {
    installStorageMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('export includes fulfillments and active-session cache for the user', async () => {
    const { buildUserDataExport } = await import('./privacy');

    localStorage.setItem(
      'bc_users',
      JSON.stringify([
        {
          id: 'u1',
          email: 'a@b.c',
          firstName: 'Ada',
          lastName: 'L',
          loyaltyPoints: 0,
          loyaltyTier: 'bronze',
          totalKwh: 0,
          totalSessions: 0,
          vehicles: [],
          paymentMethods: [],
          favoriteStationIds: [],
          notifications: {},
        },
      ])
    );
    localStorage.setItem(
      'bc_sessions',
      JSON.stringify({
        u1: [
          {
            id: 's1',
            stationId: 'st1',
            stationName: 'Hof',
            connectorId: 'c1',
            connectorType: 'CCS',
            powerKw: 22,
            status: 'completed',
            startedAt: '2026-08-18T10:00:00.000Z',
            endedAt: '2026-08-18T10:30:00.000Z',
            energyKwh: 5,
            costEur: 2,
            pricePerKwh: 0.4,
          },
        ],
      })
    );
    localStorage.setItem('bc_redeemed', JSON.stringify({ u1: ['rw1'] }));
    localStorage.setItem(
      'bc_reward_fulfillments',
      JSON.stringify({
        u1: [
          {
            id: 'ff1',
            userId: 'u1',
            rewardId: 'rw1',
            type: 'energy_discount',
            status: 'active',
            payload: { percent: 10 },
            redeemedAt: '2026-08-18T09:00:00.000Z',
            expiresAt: null,
            usedAt: null,
            sessionId: null,
          },
        ],
      })
    );
    sessionStorage.setItem(
      'bc_active_session_cache',
      JSON.stringify({
        userId: 'u1',
        savedAt: '2026-08-19T12:00:00.000Z',
        session: {
          id: 's-active',
          stationId: 'st1',
          stationName: 'Hof',
          connectorId: 'c1',
          connectorType: 'CCS',
          powerKw: 22,
          status: 'active',
          startedAt: '2026-08-19T11:00:00.000Z',
          energyKwh: 1.2,
          costEur: 0.5,
          pricePerKwh: 0.4,
        },
      })
    );

    const exp = buildUserDataExport('u1');
    expect(exp.profile).toMatchObject({ id: 'u1', email: 'a@b.c' });
    expect((exp.profile as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(exp.sessions).toHaveLength(1);
    expect(exp.redeemedRewards).toEqual(['rw1']);
    expect(exp.rewardFulfillments).toHaveLength(1);
    expect((exp.rewardFulfillments as { id: string }[])[0].id).toBe('ff1');
    expect(exp.activeSessionCache).toMatchObject({
      id: 's-active',
      status: 'active',
      stationId: 'st1',
    });
  });

  it('purge removes fulfillments + own active cache; keeps other users', async () => {
    const { purgeUserLocalData, buildUserDataExport } = await import('./privacy');
    const { loadActiveSessionCache, loadFulfillments, loadUsers } = await import('./storage');

    localStorage.setItem(
      'bc_users',
      JSON.stringify([
        {
          id: 'u1',
          email: 'a@b.c',
          firstName: 'Ada',
          lastName: 'L',
          loyaltyPoints: 0,
          loyaltyTier: 'bronze',
          totalKwh: 0,
          totalSessions: 0,
          vehicles: [],
          paymentMethods: [],
          favoriteStationIds: [],
          notifications: {},
        },
        {
          id: 'u2',
          email: 'b@b.c',
          firstName: 'Bob',
          lastName: 'B',
          loyaltyPoints: 1,
          loyaltyTier: 'bronze',
          totalKwh: 1,
          totalSessions: 1,
          vehicles: [],
          paymentMethods: [],
          favoriteStationIds: [],
          notifications: {},
        },
      ])
    );
    localStorage.setItem(
      'bc_sessions',
      JSON.stringify({
        u1: [
          {
            id: 's1',
            stationId: 'st1',
            stationName: 'Hof',
            connectorId: 'c1',
            connectorType: 'CCS',
            powerKw: 22,
            status: 'completed',
            startedAt: '2026-08-18T10:00:00.000Z',
            energyKwh: 5,
            costEur: 2,
            pricePerKwh: 0.4,
          },
        ],
        u2: [
          {
            id: 's2',
            stationId: 'st2',
            stationName: 'Park',
            connectorId: 'c2',
            connectorType: 'Type2',
            powerKw: 11,
            status: 'completed',
            startedAt: '2026-08-18T11:00:00.000Z',
            energyKwh: 3,
            costEur: 1,
            pricePerKwh: 0.4,
          },
        ],
      })
    );
    localStorage.setItem('bc_redeemed', JSON.stringify({ u1: ['rw1'], u2: ['rw2'] }));
    localStorage.setItem(
      'bc_reward_fulfillments',
      JSON.stringify({
        u1: [
          {
            id: 'ff1',
            userId: 'u1',
            rewardId: 'rw1',
            type: 'voucher',
            status: 'active',
            payload: {},
            redeemedAt: '2026-08-18T09:00:00.000Z',
            expiresAt: null,
            usedAt: null,
            sessionId: null,
          },
        ],
        u2: [
          {
            id: 'ff2',
            userId: 'u2',
            rewardId: 'rw2',
            type: 'voucher',
            status: 'active',
            payload: {},
            redeemedAt: '2026-08-18T09:00:00.000Z',
            expiresAt: null,
            usedAt: null,
            sessionId: null,
          },
        ],
      })
    );
    localStorage.setItem('bc_current_user', 'u1');
    sessionStorage.setItem(
      'bc_active_session_cache',
      JSON.stringify({
        userId: 'u1',
        savedAt: '2026-08-19T12:00:00.000Z',
        session: {
          id: 's-active',
          stationId: 'st1',
          stationName: 'Hof',
          connectorId: 'c1',
          connectorType: 'CCS',
          powerKw: 22,
          status: 'active',
          startedAt: '2026-08-19T11:00:00.000Z',
          energyKwh: 1.2,
          costEur: 0.5,
          pricePerKwh: 0.4,
        },
      })
    );

    purgeUserLocalData('u1');

    expect(loadUsers().map((u) => u.id)).toEqual(['u2']);
    expect(loadFulfillments('u1')).toEqual([]);
    expect(loadFulfillments('u2')).toHaveLength(1);
    expect(loadActiveSessionCache('u1')).toBeNull();
    expect(localStorage.getItem('bc_current_user')).toBeNull();

    const remainingSessions = JSON.parse(localStorage.getItem('bc_sessions') || '{}');
    expect(remainingSessions.u1).toBeUndefined();
    expect(remainingSessions.u2).toHaveLength(1);

    const remainingRedeemed = JSON.parse(localStorage.getItem('bc_redeemed') || '{}');
    expect(remainingRedeemed.u1).toBeUndefined();
    expect(remainingRedeemed.u2).toEqual(['rw2']);

    // u2 export still works
    const exp2 = buildUserDataExport('u2');
    expect((exp2.profile as { id: string }).id).toBe('u2');
    expect(exp2.rewardFulfillments).toHaveLength(1);
  });

  it('purge does not clear active cache belonging to another user', async () => {
    const { purgeUserLocalData } = await import('./privacy');
    const { loadActiveSessionCache } = await import('./storage');

    localStorage.setItem(
      'bc_users',
      JSON.stringify([
        {
          id: 'u1',
          email: 'a@b.c',
          firstName: 'Ada',
          lastName: 'L',
          loyaltyPoints: 0,
          loyaltyTier: 'bronze',
          totalKwh: 0,
          totalSessions: 0,
          vehicles: [],
          paymentMethods: [],
          favoriteStationIds: [],
          notifications: {},
        },
      ])
    );
    sessionStorage.setItem(
      'bc_active_session_cache',
      JSON.stringify({
        userId: 'u2',
        savedAt: '2026-08-19T12:00:00.000Z',
        session: {
          id: 's-other',
          stationId: 'st9',
          stationName: 'Other',
          connectorId: 'c9',
          connectorType: 'CCS',
          powerKw: 50,
          status: 'active',
          startedAt: '2026-08-19T11:00:00.000Z',
          energyKwh: 0.1,
          costEur: 0.1,
          pricePerKwh: 0.4,
        },
      })
    );

    purgeUserLocalData('u1');
    expect(loadActiveSessionCache('u2')?.id).toBe('s-other');
  });
});
