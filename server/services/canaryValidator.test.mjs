/**
 * Node built-in test runner (no jest on root app).
 * Run: node --test server/services/canaryValidator.test.mjs
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  canaryValidate,
  canaryValidateAlways,
  getCanaryStats,
  resetCanaryStats,
} from './canaryValidator.mjs';
import {
  HasuraTransactionRowSchema,
  HasuraChargingStationRowSchema,
  CitrineosWebhookRawSchema,
  RestTariffListSchema,
} from './citrineosSchemas.mjs';

beforeEach(() => {
  resetCanaryStats();
  delete process.env.CANARY_DISABLED;
  delete process.env.CANARY_FORCE;
  delete process.env.CANARY_SAMPLE_RATE;
});

describe('citrineosSchemas', () => {
  it('accepts Hasura transaction row with aliases', () => {
    const row = {
      transactionId: 'tx-1',
      stationId: 42,
      isActive: true,
      totalKwh: '12.5',
      totalCost: 3.1,
      chargingState: 'Charging',
    };
    const r = HasuraTransactionRowSchema.safeParse(row);
    assert.equal(r.success, true);
    assert.equal(r.data.totalKwh, 12.5);
  });

  it('accepts charging station with nested EVSE/connector/tariff', () => {
    const row = {
      id: 7,
      ocppConnectionName: 'CS-01',
      isOnline: 1,
      Evses: [
        {
          evseId: 1,
          Connectors: [
            {
              connectorId: 1,
              status: 'Available',
              type: 'CCS2',
              maximumPowerWatts: 50000,
              Tariff: { pricePerKwh: 0.49, currency: 'EUR' },
            },
          ],
        },
      ],
      Location: { name: 'Hof', city: 'Machern' },
    };
    const r = HasuraChargingStationRowSchema.safeParse(row);
    assert.equal(r.success, true);
  });

  it('accepts webhook raw with meterValue wrapper', () => {
    const raw = {
      eventType: 'Updated',
      transactionId: 'abc',
      meterValue: [
        {
          sampledValue: [
            { measurand: 'Energy.Active.Import.Register', value: '1500', unit: 'Wh' },
          ],
        },
      ],
    };
    const r = CitrineosWebhookRawSchema.safeParse(raw);
    assert.equal(r.success, true);
  });

  it('accepts tariff list array or wrapped object', () => {
    assert.equal(RestTariffListSchema.safeParse([{ pricePerKwh: 0.4 }]).success, true);
    assert.equal(
      RestTariffListSchema.safeParse({ tariffs: [{ id: 1, pricePerKwh: '0.39' }] }).success,
      true
    );
  });

  it('rejects non-object transaction', () => {
    const r = HasuraTransactionRowSchema.safeParse('nope');
    assert.equal(r.success, false);
  });
});

describe('canaryValidate', () => {
  it('skips when disabled', () => {
    process.env.CANARY_DISABLED = '1';
    const r = canaryValidate('hasura.transaction', { transactionId: 'x' });
    assert.equal(r.sampled, false);
    assert.equal(r.ok, null);
  });

  it('records ok on valid forced sample', () => {
    const r = canaryValidateAlways('hasura.transaction', {
      transactionId: 't1',
      isActive: false,
      totalKwh: 1.2,
    });
    assert.equal(r.sampled, true);
    assert.equal(r.ok, true);
    const stats = getCanaryStats();
    assert.equal(stats.bySchema['hasura.transaction'].ok, 1);
    assert.equal(stats.bySchema['hasura.transaction'].fail, 0);
  });

  it('records fail and recent mismatch on drift', () => {
    // array is not an object row
    const r = canaryValidateAlways('hasura.transaction', [1, 2, 3], {
      source: 'unit-test',
    });
    assert.equal(r.sampled, true);
    assert.equal(r.ok, false);
    const stats = getCanaryStats();
    assert.equal(stats.bySchema['hasura.transaction'].fail, 1);
    assert.equal(stats.recentMismatches.length, 1);
    assert.equal(stats.recentMismatches[0].source, 'unit-test');
    assert.equal(stats.recentMismatches[0].schemaId, 'hasura.transaction');
  });

  it('validates webhook schema always', () => {
    const ok = canaryValidateAlways(
      'webhook.citrineos.raw',
      { data: { transactionId: 'z', totalKwh: 2 } },
      { source: 'test' }
    );
    assert.equal(ok.ok, true);

    const bad = canaryValidateAlways('webhook.citrineos.raw', null, { source: 'test' });
    assert.equal(bad.ok, false);
  });

  it('validates transactionsData envelope', () => {
    const r = canaryValidateAlways(
      'hasura.transactionsData',
      {
        Transactions: [{ transactionId: 'a', totalEnergyKwh: 3, active: true }],
      },
      { source: 'test' }
    );
    assert.equal(r.ok, true);
  });
});
