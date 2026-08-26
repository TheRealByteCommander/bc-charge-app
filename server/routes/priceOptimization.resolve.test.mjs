/**
 * Run: node --test server/routes/priceOptimization.resolve.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStationConnector } from './priceOptimization.mjs';

describe('resolveStationConnector', () => {
  it('parses canonical app connector ids', () => {
    const r = resolveStationConnector('cp-1', 'evse-2-conn-3');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.stationId, 'cp-1');
      assert.equal(r.evseId, 2);
      assert.equal(r.connectorId, 3);
    }
  });

  it('accepts bare connector numbers (default evse 1)', () => {
    const r = resolveStationConnector('go-e-1', '1');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.evseId, 1);
      assert.equal(r.connectorId, 1);
    }
  });

  it('rejects missing station / invalid connector (no NaN)', () => {
    assert.equal(resolveStationConnector('', 'evse-1-conn-1').ok, false);
    assert.equal(resolveStationConnector('cp', 'evse-1-conn-null').ok, false);
    assert.equal(resolveStationConnector('cp', 'nope').ok, false);
    // Old split('-')[3] would yield NaN for "evse-1-conn-2" if index wrong —
    // ensure multi-digit still works:
    const multi = resolveStationConnector('cp', 'evse-10-conn-12');
    assert.equal(multi.ok, true);
    if (multi.ok) {
      assert.equal(multi.evseId, 10);
      assert.equal(multi.connectorId, 12);
    }
  });
});
