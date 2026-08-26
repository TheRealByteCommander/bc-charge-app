/**
 * Run: node --test server/utils/connectorRef.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConnectorRef } from './connectorRef.mjs';

describe('parseConnectorRef', () => {
  it('parses canonical evse-N-conn-M ids', () => {
    assert.deepEqual(parseConnectorRef('evse-1-conn-2'), { evseId: 1, connectorId: 2 });
    assert.deepEqual(parseConnectorRef('evse-0-conn-0'), { evseId: 0, connectorId: 0 });
    assert.deepEqual(parseConnectorRef('EVSE-3-CONN-4'), { evseId: 3, connectorId: 4 });
  });

  it('accepts bare numeric connector id with default evse 1', () => {
    assert.deepEqual(parseConnectorRef('2'), { evseId: 1, connectorId: 2 });
    assert.deepEqual(parseConnectorRef(5), { evseId: 1, connectorId: 5 });
  });

  it('rejects garbage / split-index traps', () => {
    assert.equal(parseConnectorRef('evse-1-conn-null'), null);
    assert.equal(parseConnectorRef('evse-1-conn-'), null);
    assert.equal(parseConnectorRef('conn-1'), null);
    assert.equal(parseConnectorRef(''), null);
    assert.equal(parseConnectorRef(null), null);
    assert.equal(parseConnectorRef('evse-x-conn-y'), null);
    // Old split('-')[3] would NaN on bare "1" or mis-shaped strings — we don't.
    assert.equal(parseConnectorRef('a-b-c-d'), null);
  });
});
