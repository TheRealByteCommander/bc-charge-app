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
  evaluatePinBumpReadiness,
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
  delete process.env.CANARY_PIN_MIN_SAMPLES;
  delete process.env.CANARY_PIN_MAX_FAIL_RATE;
  delete process.env.CANARY_PIN_REQUIRE_FORCE;
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
    assert.ok(stats.pinBump);
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

describe('pinBump readiness gate', () => {
  it('blocks without CANARY_FORCE and insufficient samples', () => {
    const r = evaluatePinBumpReadiness({ minSamples: 50, requireForce: true });
    assert.equal(r.ready, false);
    assert.ok(
      r.blockers.some((b) => b.startsWith('MIN_SAMPLES') || b === 'CANARY_FORCE_REQUIRED')
    );
  });

  it('soak samples clean: #849 dual-path clears structural matrix; pinBump can ready', () => {
    process.env.CANARY_FORCE = '1';
    for (let i = 0; i < 50; i += 1) {
      canaryValidateAlways('hasura.transaction', {
        transactionId: `t-${i}`,
        isActive: false,
        totalKwh: 1,
      });
    }
    const r = evaluatePinBumpReadiness({
      minSamples: 50,
      maxFailRate: 0.02,
      requireForce: true,
    });
    // Dual-path #849 no longer structurally blocks; clean forced soak may ready=true.
    assert.equal(r.dataApiMigration.ready, true, JSON.stringify(r.dataApiMigration));
    assert.ok(!r.blockers.some((b) => b.includes('849') || b.startsWith('DATA_API_') || b.startsWith('ROUTE_BLOCKS:')));
    assert.equal(r.ready, true, JSON.stringify(r.blockers));
    assert.equal(r.totals.total >= 50, true);
    const stats = getCanaryStats();
    assert.equal(stats.pinBump.ready, true);
    assert.equal(stats.upstreamWatch, 'v2.0.0-beta3');
    assert.equal(stats.integrationVersion, '1.8.4');
    assert.ok(Array.isArray(stats.upstreamOpen));
    assert.ok(Array.isArray(stats.upstreamMergedNext));
    assert.ok(stats.upstreamMergedNext.some((x) => x.id === 849), 'merged-next #849 drop data API');
    assert.ok(stats.upstreamMergedNext.some((x) => x.id === 846), 'merged-next #846 audit-insert crash');
    assert.ok(stats.upstreamOpen.some((x) => x.id === 851), 'watch #851 tenant path');
    assert.ok(stats.upstreamOpen.some((x) => x.id === 852), 'watch #852 measurand drop');
    assert.ok(stats.upstreamOpen.some((x) => x.id === 867), 'watch #867 OCPPMessages partition');
    assert.ok(!stats.upstreamOpen.some((x) => x.id === 849), '#849 no longer open');
    assert.ok(!stats.upstreamOpen.some((x) => x.id === 846), '#846 no longer open');
    assert.ok(stats.dataApiMigration);
    assert.equal(stats.dataApiMigration.upstreamPr, 849);
    assert.equal(stats.dataApiMigration.blocking, 0);
    assert.equal(stats.dataApiMigration.readiness.ready, true);
  });

  it('blocks on high fail rate', () => {
    process.env.CANARY_FORCE = '1';
    for (let i = 0; i < 40; i += 1) {
      canaryValidateAlways('hasura.transaction', {
        transactionId: `ok-${i}`,
        isActive: true,
        totalKwh: 1,
      });
    }
    for (let i = 0; i < 20; i += 1) {
      canaryValidateAlways('hasura.transaction', null, { source: 'fail-test' });
    }
    const r = evaluatePinBumpReadiness({
      minSamples: 50,
      maxFailRate: 0.02,
      requireForce: true,
    });
    assert.equal(r.ready, false);
    assert.ok(
      r.blockers.some((b) => b.startsWith('FAIL_RATE') || b.startsWith('SCHEMA_FAIL'))
    );
  });
});
