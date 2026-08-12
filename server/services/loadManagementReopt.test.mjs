/**
 * Run: node --test server/services/loadManagementReopt.test.mjs
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldTriggerLmReopt,
  resolveStationIdsForReopt,
  isReoptDebounced,
  resetLmReoptDebounce,
  triggerLmReoptFromWebhook,
} from './loadManagementReopt.mjs';

const KEYS = [
  'LOAD_MANAGEMENT_DISABLED',
  'LM_DISABLED',
  'LOAD_MANAGEMENT_ENABLED',
  'LM_ENABLED',
  'LOAD_MANAGEMENT_API_URL',
  'LM_API_URL',
  'LM_API_KEY',
  'LOAD_MANAGEMENT_API_KEY',
];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetLmReoptDebounce();
});

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetLmReoptDebounce();
  mock.restoreAll();
});

describe('shouldTriggerLmReopt', () => {
  it('accepts ChargingRateChanged case-insensitively', () => {
    assert.equal(shouldTriggerLmReopt('ChargingRateChanged'), true);
    assert.equal(shouldTriggerLmReopt('chargingratechanged'), true);
    assert.equal(shouldTriggerLmReopt('LimitSet'), true);
    assert.equal(shouldTriggerLmReopt('MeterValuePeriodic'), false);
    assert.equal(shouldTriggerLmReopt(null), false);
    assert.equal(shouldTriggerLmReopt(''), false);
  });
});

describe('resolveStationIdsForReopt', () => {
  it('merges event + session data_json + adhoc station_id', () => {
    const ids = resolveStationIdsForReopt({
      event: { stationId: 'ev-from-event' },
      sessionRows: [
        {
          kind: 'adhoc',
          station_id: 'adhoc-col',
          data_json: JSON.stringify({ stationId: 'json-station', citrineosTransactionId: 't1' }),
        },
        {
          kind: 'charging',
          data_json: { connectionName: 'conn-1' },
        },
      ],
    });
    assert.deepEqual(ids.sort(), ['adhoc-col', 'conn-1', 'ev-from-event', 'json-station'].sort());
  });
});

describe('triggerLmReoptFromWebhook', () => {
  it('skips when LM disabled', async () => {
    const r = await triggerLmReoptFromWebhook({
      triggerReason: 'ChargingRateChanged',
      stationIds: ['s1'],
    });
    assert.equal(r.attempted, false);
    assert.equal(r.skipped, 'lm_disabled');
  });

  it('skips non-reopt triggers', async () => {
    process.env.LM_ENABLED = '1';
    process.env.LM_API_KEY = 'k';
    const r = await triggerLmReoptFromWebhook({
      triggerReason: 'MeterValuePeriodic',
      stationIds: ['s1'],
    });
    assert.equal(r.attempted, false);
    assert.equal(r.skipped, 'trigger_not_reopt');
  });

  it('POSTs composite schedule per station and debounces', async () => {
    process.env.LM_ENABLED = '1';
    process.env.LM_API_KEY = 'secret';
    process.env.LM_API_URL = 'http://lm.test:3003';

    const calls = [];
    mock.method(globalThis, 'fetch', async (url, init) => {
      calls.push({ url: String(url), method: init?.method, body: init?.body });
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: { stationId: 'st-9', status: 'Accepted', effectiveLimitKw: 11 },
          }),
      };
    });

    const first = await triggerLmReoptFromWebhook({
      triggerReason: 'ChargingRateChanged',
      stationIds: ['st-9'],
      transactionId: 'tx-1',
      now: 1_000_000,
      debounceMs: 15_000,
    });
    assert.equal(first.attempted, true);
    assert.deepEqual(first.stations, ['st-9']);
    assert.equal(first.results[0]?.ok, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/load\/composite-schedules\/st-9$/);
    assert.equal(calls[0].method, 'POST');

    const second = await triggerLmReoptFromWebhook({
      triggerReason: 'ChargingRateChanged',
      stationIds: ['st-9'],
      now: 1_005_000,
      debounceMs: 15_000,
    });
    assert.equal(second.attempted, false);
    assert.equal(second.skipped, 'debounced');
    assert.equal(calls.length, 1);

    assert.equal(isReoptDebounced('st-9', { now: 1_005_000, debounceMs: 15_000 }), true);
    assert.equal(isReoptDebounced('st-9', { now: 1_020_000, debounceMs: 15_000 }), false);
  });

  it('falls back to refresh-all when station unknown', async () => {
    process.env.LM_ENABLED = '1';
    process.env.LM_API_KEY = 'secret';

    const calls = [];
    mock.method(globalThis, 'fetch', async (url, init) => {
      calls.push({ url: String(url), method: init?.method });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { schedules: [] } }),
      };
    });

    const r = await triggerLmReoptFromWebhook({
      triggerReason: 'LimitSet',
      stationIds: [],
      now: 2_000_000,
      force: true,
    });
    assert.equal(r.attempted, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/load\/composite-schedules$/);
    assert.equal(calls[0].method, 'POST');
  });
});
