/**
 * Run: node --test server/db.webhookEnergy.test.mjs
 * Pure helpers used by applyCitrineosWebhookToSessions energy path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMonotonicEnergyKwh } from './db.mjs';

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
