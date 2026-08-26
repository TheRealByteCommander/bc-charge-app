/**
 * Run: node --test server/utils/ocppChargingState.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOcppChargingState,
  readOcppChargingStateFromRow,
} from './ocppChargingState.mjs';

describe('normalizeOcppChargingState', () => {
  it('accepts canonical + case variants', () => {
    assert.equal(normalizeOcppChargingState('Charging'), 'Charging');
    assert.equal(normalizeOcppChargingState('suspendedevse'), 'SuspendedEVSE');
    assert.equal(normalizeOcppChargingState('  Idle '), 'Idle');
    assert.equal(normalizeOcppChargingState('EVConnected'), 'EVConnected');
    assert.equal(normalizeOcppChargingState('SuspendedEV'), 'SuspendedEV');
  });

  it('rejects lifecycle/garbage (no invent)', () => {
    assert.equal(normalizeOcppChargingState('active'), null);
    assert.equal(normalizeOcppChargingState('completed'), null);
    assert.equal(normalizeOcppChargingState('stopped'), null);
    assert.equal(normalizeOcppChargingState('NotARealState'), null);
    assert.equal(normalizeOcppChargingState(''), null);
    assert.equal(normalizeOcppChargingState(null), null);
    assert.equal(normalizeOcppChargingState(1), null);
  });
});

describe('readOcppChargingStateFromRow', () => {
  it('reads chargingState aliases and ignores state lifecycle', () => {
    assert.equal(
      readOcppChargingStateFromRow({ chargingState: 'Charging', state: 'active' }),
      'Charging'
    );
    assert.equal(
      readOcppChargingStateFromRow({ charging_state: 'SuspendedEVSE' }),
      'SuspendedEVSE'
    );
    assert.equal(
      readOcppChargingStateFromRow({
        transactionInfo: { chargingState: 'Idle' },
      }),
      'Idle'
    );
    // Poison path that previously leaked via `tx.state` fallback:
    assert.equal(readOcppChargingStateFromRow({ state: 'active' }), null);
    assert.equal(readOcppChargingStateFromRow({ state: 'completed' }), null);
    assert.equal(readOcppChargingStateFromRow({ state: 'Charging' }), null);
    assert.equal(readOcppChargingStateFromRow(null), null);
  });
});
