import { describe, expect, it } from 'vitest';
import { computeCost, buildAdjustmentEntries } from './costEngine.mjs';
import { buildTariffVersionPayload } from './tariffModel.mjs';
import { createTariffSnapshot } from './tariffSnapshot.mjs';
import { deriveIdleIntervals } from './events.mjs';
import { goldenCases } from './goldenCases.mjs';
import { moneyFromDecimal, moneyToDecimal, roundMoneyToCents } from './money.mjs';

function runCase(tc) {
  const body = buildTariffVersionPayload({
    tariffId: tc.tariff.tariffId,
    version: tc.tariff.version,
    name: tc.tariff.name,
    validFrom: '2026-01-01T00:00:00.000Z',
    timezone: tc.tariff.timezone,
    currency: tc.tariff.currency,
    taxRateBp: tc.tariff.taxRateBp,
    components: tc.tariff.components,
    minPrice: tc.tariff.minPrice ?? null,
    maxPrice: tc.tariff.maxPrice ?? null,
  });
  const snapshot = createTariffSnapshot({
    sessionId: `sess_${tc.id}`,
    tariffVersion: { ...body, id: `v_${tc.id}` },
    source: 'manual',
  });
  return computeCost({ snapshot, events: tc.events });
}

describe('money', () => {
  it('rundet HALF_UP auf Cent', () => {
    const v = moneyFromDecimal('1.2345');
    expect(moneyToDecimal(roundMoneyToCents(v))).toBe('1.23');
  });
});

describe('idle events', () => {
  it('startet Idle nur nach Charging + SuspendedEV', () => {
    const intervals = deriveIdleIntervals([
      { at: '2026-01-01T10:00:00Z', type: 'session_start' },
      { at: '2026-01-01T10:05:00Z', type: 'charging_state', chargingState: 'Charging' },
      { at: '2026-01-01T10:15:00Z', type: 'charging_state', chargingState: 'SuspendedEV' },
      { at: '2026-01-01T10:30:00Z', type: 'session_stop' },
    ]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0].start).toBe('2026-01-01T10:15:00Z');
    expect(intervals[0].end).toBe('2026-01-01T10:30:00Z');
  });

  it('ignoriert konstante MeterValues ohne State-Wechsel', () => {
    const intervals = deriveIdleIntervals([
      { at: '2026-01-01T10:00:00Z', type: 'session_start' },
      { at: '2026-01-01T10:05:00Z', type: 'meter_value', energyWh: 1000 },
      { at: '2026-01-01T10:10:00Z', type: 'meter_value', energyWh: 1000 },
    ]);
    expect(intervals).toHaveLength(0);
  });
});

describe('golden master cost cases', () => {
  for (const tc of goldenCases) {
    it(tc.id, () => {
      const result = runCase(tc);
      if (tc.expect.netEur != null) expect(result.netEur).toBe(tc.expect.netEur);
      if (tc.expect.grossEur != null) expect(result.grossEur).toBe(tc.expect.grossEur);
      if (tc.expect.energyWh != null) expect(result.energyWh).toBe(tc.expect.energyWh);
      if (tc.expect.idleSeconds != null) expect(result.idleSeconds).toBeGreaterThanOrEqual(tc.expect.idleSeconds);
    });
  }
});

describe('tariff snapshot immutability', () => {
  it('ändert Hash wenn Tarifkomponente wechselt', () => {
    const base = buildTariffVersionPayload({
      tariffId: 't',
      version: 1,
      name: 'A',
      validFrom: '2026-01-01T00:00:00Z',
      components: [{ kind: 'energy', rate: '0.4500' }],
    });
    const changed = buildTariffVersionPayload({
      tariffId: 't',
      version: 2,
      name: 'A',
      validFrom: '2026-01-01T00:00:00Z',
      components: [{ kind: 'energy', rate: '0.5000' }],
    });
    expect(base.hash).not.toBe(changed.hash);
  });
});

describe('adjustments', () => {
  it('erzeugt Storno + Korrektur', () => {
    const original = { netEur: '4.50', taxEur: '0.86', grossEur: '5.36' };
    const corrected = { netEur: '4.80', taxEur: '0.91', grossEur: '5.71' };
    const entries = buildAdjustmentEntries(original, corrected, 'verspäteter MeterValue');
    expect(entries).toHaveLength(2);
    expect(entries[0].entryType).toBe('storno');
    expect(entries[1].entryType).toBe('adjustment');
  });
});
