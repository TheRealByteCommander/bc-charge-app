import { describe, expect, it } from 'vitest';
import type { ChargingSession } from '../types';
import { liveSessionMetricsEqual } from './sessionLiveEqual';

function base(over: Partial<ChargingSession> = {}): ChargingSession {
  return {
    id: 'sess_1',
    stationId: 'st-1',
    stationName: 'Test',
    connectorId: 'c1',
    connectorType: 'CCS',
    powerKw: 50,
    vehicleId: 'v1',
    paymentMethodId: 'pm1',
    startedAt: '2026-08-19T01:00:00.000Z',
    status: 'active',
    energyKwh: 12.5,
    costEur: 6.25,
    pricePerKwh: 0.5,
    sessionFee: 0,
    pointsEarned: 15,
    ...over,
  };
}

describe('liveSessionMetricsEqual', () => {
  it('is true for identical live metrics (ignores stationName-only drift)', () => {
    const a = base();
    const b = base({ stationName: 'Other label' });
    expect(liveSessionMetricsEqual(a, b)).toBe(true);
  });

  it('is false when energy or cost changes', () => {
    expect(liveSessionMetricsEqual(base(), base({ energyKwh: 12.6 }))).toBe(false);
    expect(liveSessionMetricsEqual(base(), base({ costEur: 6.26 }))).toBe(false);
  });

  it('treats sub-cent cost noise as equal', () => {
    expect(liveSessionMetricsEqual(base({ costEur: 1.001 }), base({ costEur: 1.004 }))).toBe(true);
  });

  it('is false on chargingState / power changes', () => {
    expect(liveSessionMetricsEqual(base(), base({ chargingState: 'SuspendedEV' }))).toBe(false);
    expect(liveSessionMetricsEqual(base(), base({ powerKw: 22 }))).toBe(false);
  });

  it('handles nullish pair edges', () => {
    expect(liveSessionMetricsEqual(null, null)).toBe(true);
    expect(liveSessionMetricsEqual(base(), null)).toBe(false);
    expect(liveSessionMetricsEqual(undefined, undefined)).toBe(true);
  });
});
