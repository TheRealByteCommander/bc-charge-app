/**
 * Run: node --test server/services/pvSurplusCharging.test.mjs
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePerStationSurplusKw,
  getCurrentPvSurplus,
  resetPvSurplusState,
  setPvSurplusTestDeps,
  updatePvSurplus,
  optimizeChargingWithPvSurplus,
  reportPvSurplus,
} from './pvSurplusCharging.mjs';

const KEYS = [
  'LOAD_MANAGEMENT_DISABLED',
  'LM_DISABLED',
  'LOAD_MANAGEMENT_ENABLED',
  'LM_ENABLED',
  'LOAD_MANAGEMENT_API_URL',
  'LM_API_URL',
  'LM_API_KEY',
  'LOAD_MANAGEMENT_API_KEY',
  'PV_SURPLUS_ALLOCATION_FACTOR',
  'PV_SURPLUS_MIN_STATION_KW',
  'CITRINEOS_API_URL',
];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetPvSurplusState();
});

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetPvSurplusState();
});

describe('computePerStationSurplusKw', () => {
  it('returns 0 for empty station set', () => {
    assert.equal(computePerStationSurplusKw(20, 0), 0);
  });

  it('splits surplus equally and respects min floor', () => {
    assert.equal(computePerStationSurplusKw(20, 2, { minStationPowerKw: 1.4 }), 10);
    assert.equal(computePerStationSurplusKw(0.5, 2, { minStationPowerKw: 1.4 }), 1.4);
  });

  it('applies allocation factor and ceiling', () => {
    const kw = computePerStationSurplusKw(20, 2, {
      allocationFactor: 0.5,
      minStationPowerKw: 1.4,
      ceilingKw: 4,
    });
    assert.equal(kw, 4);
  });
});

describe('updatePvSurplus / getCurrentPvSurplus', () => {
  it('stores surplus and rejects invalid values', () => {
    const r = updatePvSurplus(12.5);
    assert.equal(r.surplus, 12.5);
    assert.equal(typeof r.updateTime, 'string');
    assert.equal(getCurrentPvSurplus().surplus, 12.5);

    assert.throws(() => updatePvSurplus(-1), /non-negative/);
    assert.throws(() => updatePvSurplus(NaN), /non-negative/);
  });
});

describe('optimizeChargingWithPvSurplus + reportPvSurplus', () => {
  it('forwards to LM when enabled', async () => {
    /** @type {Array<[string, any]>} */
    const calls = [];
    setPvSurplusTestDeps({
      isLmEnabled: () => true,
      lmFetch: async (path, opts) => {
        calls.push([path, opts]);
        return { ok: true, status: 200, data: { success: true }, error: null };
      },
    });

    const result = await optimizeChargingWithPvSurplus({ surplus: 8 });
    assert.equal(result.success, true);
    assert.equal(result.mode, 'load_management');
    assert.equal(result.surplus, 8);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api/pv-surplus');
    assert.deepEqual(calls[0][1]?.body, { surplus: 8 });
  });

  it('reportPvSurplus apply=false only stores', async () => {
    const result = await reportPvSurplus(3.3, { apply: false });
    assert.equal(result.success, true);
    assert.equal(result.applied, false);
    assert.equal(result.data.surplus, 3.3);
    assert.equal(result.optimize, null);
  });

  it('idle when LM off and no active targets', async () => {
    setPvSurplusTestDeps({
      isLmEnabled: () => false,
      listTargets: async () => [],
    });
    const result = await optimizeChargingWithPvSurplus({
      surplus: 5,
      targets: [],
    });
    assert.equal(result.success, true);
    assert.equal(result.mode, 'idle');
    assert.equal(result.sessionsAffected, 0);
  });

  it('no_surplus mode leaves profiles when surplus is 0', async () => {
    setPvSurplusTestDeps({ isLmEnabled: () => false });
    const result = await optimizeChargingWithPvSurplus({
      surplus: 0,
      targets: [{ stationId: 'CS-1', powerKw: 22 }],
    });
    assert.equal(result.success, true);
    assert.equal(result.mode, 'no_surplus');
    assert.equal(result.sessionsAffected, 0);
    assert.deepEqual(result.stations, ['CS-1']);
  });

  it('falls back to citrineos_direct when LM forward fails', async () => {
    /** @type {string[]} */
    const lmPaths = [];
    /** @type {Array<{ stationId: string, body: any }>} */
    const citrineCalls = [];

    setPvSurplusTestDeps({
      isLmEnabled: () => true,
      lmFetch: async (path) => {
        lmPaths.push(path);
        return { ok: false, status: 502, data: null, error: 'down' };
      },
      citrineosPost: async (_path, stationId, body) => {
        citrineCalls.push({ stationId, body });
        return [{ success: true }];
      },
    });

    const result = await optimizeChargingWithPvSurplus({
      surplus: 10,
      targets: [
        { stationId: 'CS-A', powerKw: 22 },
        { stationId: 'CS-B', powerKw: 11 },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.mode, 'citrineos_direct');
    assert.equal(result.sessionsAffected, 2);
    assert.ok(result.perStationKw > 0);
    assert.equal(lmPaths[0], '/api/pv-surplus');
    assert.equal(citrineCalls.length, 2);
    assert.equal(
      citrineCalls[0].body?.chargingProfile?.chargingProfilePurpose,
      'ChargingStationMaxProfile'
    );
    // limits are in W
    assert.equal(
      citrineCalls[0].body?.chargingProfile?.chargingSchedule?.chargingRateUnit,
      'W'
    );
  });

  it('uses LM per-station limits when forward fails but limit API works', async () => {
    /** @type {string[]} */
    const lmPaths = [];
    setPvSurplusTestDeps({
      isLmEnabled: () => true,
      lmFetch: async (path, opts) => {
        lmPaths.push(path);
        if (path === '/api/pv-surplus') {
          return { ok: false, status: 500, data: null, error: 'pv route down' };
        }
        if (path.startsWith('/api/load/limit/')) {
          return {
            ok: true,
            status: 200,
            data: { success: true, data: { maxPowerKw: opts?.body?.maxPowerKw } },
            error: null,
          };
        }
        return { ok: false, status: 404, data: null, error: 'nope' };
      },
    });

    const result = await optimizeChargingWithPvSurplus({
      surplus: 12,
      targets: [
        { stationId: 'S1', powerKw: 22 },
        { stationId: 'S2', powerKw: 22 },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.mode, 'load_management_limits');
    assert.equal(result.sessionsAffected, 2);
    assert.ok(lmPaths.some((p) => p.startsWith('/api/load/limit/')));
  });
});
