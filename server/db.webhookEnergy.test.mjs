/**
 * Run: node --test server/db.webhookEnergy.test.mjs
 * Pure helpers used by applyCitrineosWebhookToSessions energy path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendSessionPricingEvent, pickMonotonicEnergyKwh } from './db.mjs';

describe('pickMonotonicEnergyKwh', () => {
  it('accepts first sample and equal/increasing values', () => {
    assert.equal(pickMonotonicEnergyKwh(null, 1.5), 1.5);
    assert.equal(pickMonotonicEnergyKwh(undefined, 0), 0);
    assert.equal(pickMonotonicEnergyKwh(2.0, 2.0), 2.0);
    assert.equal(pickMonotonicEnergyKwh(2.0, 2.25), 2.25);
  });

  it('rejects real regressions (stale meter / unit glitch)', () => {
    assert.equal(pickMonotonicEnergyKwh(12.5, 3.5), null);
    // 12500 Wh mis-read as kWh would jump up; reverse (kWh as Wh/1000) regresses
    assert.equal(pickMonotonicEnergyKwh(12.5, 0.0125), null);
  });

  it('allows tiny float noise downward but not material drops', () => {
    assert.equal(pickMonotonicEnergyKwh(5, 5 - 1e-9), 5 - 1e-9);
    assert.equal(pickMonotonicEnergyKwh(5, 4.99), null);
  });

  it('rejects non-finite / negative next samples', () => {
    assert.equal(pickMonotonicEnergyKwh(1, NaN), null);
    assert.equal(pickMonotonicEnergyKwh(1, -0.1), null);
    assert.equal(pickMonotonicEnergyKwh(1, null), null);
    assert.equal(pickMonotonicEnergyKwh(1, ''), null);
  });

  it('recovers when previous energy was non-finite', () => {
    assert.equal(pickMonotonicEnergyKwh('nope', 3.2), 3.2);
  });
});

describe('appendSessionPricingEvent', () => {
  it('appends charging_state and session_stop for idle derivation', () => {
    let data = {};
    const a = appendSessionPricingEvent(data, {
      type: 'charging_state',
      chargingState: 'Charging',
      at: '2026-08-18T10:00:00.000Z',
    });
    assert.ok(Array.isArray(a));
    assert.equal(a.length, 1);
    assert.equal(a[0].chargingState, 'Charging');

    data = { pricingEvents: a };
    const b = appendSessionPricingEvent(data, {
      type: 'charging_state',
      chargingState: 'SuspendedEV',
      at: '2026-08-18T10:30:00.000Z',
    });
    assert.equal(b.length, 2);
    assert.equal(b[1].chargingState, 'SuspendedEV');

    data = { pricingEvents: b };
    const c = appendSessionPricingEvent(data, {
      type: 'session_stop',
      at: '2026-08-18T10:45:00.000Z',
    });
    assert.equal(c.length, 3);
    assert.equal(c[2].type, 'session_stop');
  });

  it('dedupes identical consecutive charging_state', () => {
    const first = appendSessionPricingEvent(
      {},
      { type: 'charging_state', chargingState: 'SuspendedEV', at: '2026-08-18T11:00:00.000Z' }
    );
    const again = appendSessionPricingEvent(
      { pricingEvents: first },
      { type: 'charging_state', chargingState: 'SuspendedEV', at: '2026-08-18T11:05:00.000Z' }
    );
    assert.equal(again, undefined);
  });

  it('trims head when exceeding cap', () => {
    /** @type {Array<Record<string, unknown>>} */
    const many = [];
    for (let i = 0; i < 200; i += 1) {
      many.push({
        at: `2026-08-18T12:${String(i % 60).padStart(2, '0')}:00.000Z`,
        type: 'charging_state',
        chargingState: i % 2 === 0 ? 'Charging' : 'SuspendedEV',
      });
    }
    const next = appendSessionPricingEvent(
      { pricingEvents: many },
      {
        type: 'charging_state',
        chargingState: 'Idle',
        at: '2026-08-18T13:00:00.000Z',
      }
    );
    assert.equal(next.length, 200);
    assert.equal(next[next.length - 1].chargingState, 'Idle');
    // oldest dropped
    assert.notEqual(next[0].at, many[0].at);
  });
});
