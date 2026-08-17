/**
 * Run: node --test server/db.activeTargets.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChargingTarget } from './db.mjs';

describe('normalizeChargingTarget', () => {
  it('maps account session shape', () => {
    const t = normalizeChargingTarget(
      {
        id: 's1',
        stationId: 'ELINTA-1',
        connectorId: 'c2',
        evseNumber: 2,
        powerKw: 22,
        status: 'active',
      },
      { kind: 'charging' }
    );
    assert.deepEqual(t, {
      sessionId: 's1',
      kind: 'charging',
      stationId: 'ELINTA-1',
      connectorId: 'c2',
      evseId: 2,
      powerKw: 22,
      status: 'active',
    });
  });

  it('uses column fallbacks for adhoc rows', () => {
    const t = normalizeChargingTarget(
      { status: 'charging' },
      {
        kind: 'adhoc',
        stationIdFallback: 'GOE-9',
        connectorIdFallback: 1,
      }
    );
    assert.equal(t?.stationId, 'GOE-9');
    assert.equal(t?.connectorId, '1');
    assert.equal(t?.kind, 'adhoc');
    assert.equal(t?.evseId, 1);
    assert.equal(t?.powerKw, 11); // default when missing
  });

  it('rejects missing station', () => {
    assert.equal(normalizeChargingTarget({ id: 'x' }), null);
    assert.equal(normalizeChargingTarget(null), null);
    assert.equal(normalizeChargingTarget('nope'), null);
  });

  it('reads snake_case aliases', () => {
    const t = normalizeChargingTarget({
      id: 'a',
      station_id: 'S-1',
      connector_id: '3',
      power_kw: 50,
      evse_id: 1,
      status: 'pending',
    });
    assert.equal(t?.stationId, 'S-1');
    assert.equal(t?.connectorId, '3');
    assert.equal(t?.powerKw, 50);
    assert.equal(t?.status, 'pending');
  });
});
