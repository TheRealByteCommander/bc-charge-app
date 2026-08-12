/**
 * Run: node --test server/utils/hardwareProtocol.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectHardwareProtocol, isOcpp16Station } from './hardwareProtocol.mjs';

describe('detectHardwareProtocol', () => {
  it('classifies go-e as OCPP 1.6 single-connector', () => {
    assert.deepEqual(detectHardwareProtocol('go-e', 'HOME+'), {
      hardwareModel: 'go-e',
      ocppVersion: '1.6',
      multiConnector: false,
      isOcpp16: true,
    });
    assert.equal(detectHardwareProtocol('GOE', 'Charger').hardwareModel, 'go-e');
    assert.equal(detectHardwareProtocol(null, 'go-e').isOcpp16, true);
  });

  it('classifies Elinta / CityCharge H2 as OCPP 1.6 multi-connector', () => {
    assert.deepEqual(detectHardwareProtocol('Elinta Charge', 'CityCharge H2'), {
      hardwareModel: 'CityCharge H2',
      ocppVersion: '1.6',
      multiConnector: true,
      isOcpp16: true,
    });
    assert.equal(detectHardwareProtocol('elinta', 'unknown').isOcpp16, true);
    assert.equal(detectHardwareProtocol('', 'CityCharge').multiConnector, true);
  });

  it('defaults unknown hardware to OCPP 2.0.1 generic', () => {
    assert.deepEqual(detectHardwareProtocol('ACME', 'SuperCharger'), {
      hardwareModel: 'generic',
      ocppVersion: '2.0.1',
      multiConnector: false,
      isOcpp16: false,
    });
  });
});

describe('isOcpp16Station', () => {
  it('reads vendor/model from station row shape', () => {
    assert.equal(
      isOcpp16Station({ chargePointVendor: 'go-e GmbH', chargePointModel: 'Gemini' }),
      true
    );
    assert.equal(
      isOcpp16Station({ chargePointVendor: 'Other', chargePointModel: 'X' }),
      false
    );
    assert.equal(isOcpp16Station(null), false);
  });
});
