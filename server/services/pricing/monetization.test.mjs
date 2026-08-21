import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calculateSession } from './pricingEngine.mjs';
import { calculateSplit } from './revenueShareManager.mjs';
import {
  updateSessionState,
  evaluateIdleSessions,
  clearSession,
  getTrackedSessionIds,
} from './idleTimerService.mjs';
import { verifyIntegrity, listBillingAudit } from './billingAuditLogger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const testDbPath = resolve(root, 'data', 'test-monetization.sqlite');

beforeAll(async () => {
  mkdirSync(resolve(root, 'data'), { recursive: true });
  process.env.BC_DB_CLIENT = 'sqlite';
  process.env.BC_DB_PATH = testDbPath;
  process.env.BC_BILLING_AUDIT_SECRET = 'test-audit-secret';
  const { initDb } = await import('../../db.mjs');
  await initDb();
});

beforeEach(() => {
  for (const id of getTrackedSessionIds()) clearSession(id);
});

const standardTariff = {
  id: 'standard-1',
  name: 'Standard Tarif',
  energyPricePerKwh: 0.5,
  sessionFee: 0.5,
  blockFeePerMinute: 0.1,
  gracePeriodMinutes: 15,
  taxRateBp: 1900,
};

describe('pricingEngine (aus pricing-engine.ts)', () => {
  it('berechnet Energy + Session + Idle nach Karenz', () => {
    const result = calculateSession(standardTariff, 20, 60, 30);
    expect(result.energyCost).toBe('10');
    expect(result.sessionFeeCost).toBe('0.5');
    expect(result.blockFeeCost).toBe('1.5');
    expect(result.netTotal).toBe('12');
    expect(result.grossTotal).toBe('14.28');
    expect(result.idleBillableMinutes).toBe(15);
  });

  it('keine Idle-Gebühr innerhalb der Karenz', () => {
    const result = calculateSession(standardTariff, 10, 30, 10);
    expect(result.blockFeeCost).toBe('0');
    expect(result.idleBillableMinutes).toBe(0);
  });
});

describe('revenueShareManager (aus revenue-share-manager.ts)', () => {
  it('splittet Marge 30/70 nach Energie-Pass-through', () => {
    const calculation = {
      grossTotal: '14.28',
      netTotal: '12',
      energyCost: '10',
      sessionFeeCost: '0.5',
      blockFeeCost: '1.5',
      totalKwh: 20,
      chargingDurationMinutes: 60,
      blockingDurationMinutes: 30,
    };
    const agreement = {
      partnerId: 'partner-abc',
      siteId: 'site-123',
      energyCostPassThrough: true,
      partnerMarginPercentage: 0.3,
      bcChargeMarginPercentage: 0.7,
    };
    const result = calculateSplit(calculation, agreement, 8);
    expect(result.shareableMargin).toBe('4');
    expect(result.partnerPayout).toBe('1.2');
    expect(result.bcChargePayout).toBe('2.8');
  });
});

describe('idleTimer + billingAudit (OCPP-States)', () => {
  it('startet Idle nur nach Charging → SuspendedEV und schreibt Audit', async () => {
    const sessionId = 'sess-idle-1';
    clearSession(sessionId);

    updateSessionState({
      sessionId,
      chargerId: 'cp-001',
      tariff: standardTariff,
      events: [
        { at: '2026-07-01T12:00:00.000Z', type: 'session_start' },
        { at: '2026-07-01T12:05:00.000Z', type: 'charging_state', chargingState: 'Charging' },
        { at: '2026-07-01T12:20:00.000Z', type: 'charging_state', chargingState: 'SuspendedEV' },
      ],
    });

    const results = await evaluateIdleSessions(standardTariff, '2026-07-01T12:50:00.000Z');
    expect(results.length).toBe(1);
    expect(results[0].sessionId).toBe(sessionId);
    expect(results[0].idleBillableMinutes).toBeGreaterThan(0);
    expect(results[0].audited).toBe(true);

    const entries = await listBillingAudit(sessionId);
    expect(entries.some((e) => e.event === 'BLOCK_FEE')).toBe(true);
    expect(await verifyIntegrity(sessionId)).toBe(true);
  });

  it('ignoriert konstante MeterValues ohne State-Wechsel', async () => {
    const sessionId = 'sess-idle-meter';
    clearSession(sessionId);
    updateSessionState({
      sessionId,
      tariff: standardTariff,
      events: [
        { at: '2026-07-01T12:00:00.000Z', type: 'session_start' },
        { at: '2026-07-01T12:05:00.000Z', type: 'meter_value', energyWh: 1000 },
        { at: '2026-07-01T12:35:00.000Z', type: 'meter_value', energyWh: 1000 },
      ],
    });
    const results = await evaluateIdleSessions(standardTariff, '2026-07-01T12:50:00.000Z');
    expect(results.length).toBe(0);
  });

  it('dropt corrupt track events (missing/invalid at) without throwing', async () => {
    const sessionId = 'sess-idle-corrupt';
    clearSession(sessionId);
    expect(() =>
      updateSessionState({
        sessionId,
        tariff: standardTariff,
        events: [
          { type: 'session_start' },
          null,
          { at: 'nope', type: 'charging_state', chargingState: 'Charging' },
          { at: '2026-07-01T12:00:00.000Z', type: 'session_start' },
          { at: '2026-07-01T12:05:00.000Z', type: 'charging_state', chargingState: 'Charging' },
          { at: '2026-07-01T12:20:00.000Z', type: 'charging_state', chargingState: 'SuspendedEV' },
        ],
      })
    ).not.toThrow();

    const results = await evaluateIdleSessions(standardTariff, 'not-a-timestamp');
    expect(results.length).toBe(1);
    expect(results[0].sessionId).toBe(sessionId);
    expect(Number.isFinite(results[0].idleBillableMinutes)).toBe(true);
  });
});
