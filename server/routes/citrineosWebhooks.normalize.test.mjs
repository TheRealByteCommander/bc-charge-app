import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCitrineosWebhookPayload } from './citrineosWebhooks.mjs';

describe('normalizeCitrineosWebhookPayload OCPP2 nested', () => {
  it('reads transactionId/remoteStartId from transactionInfo and energy from meterValue Wh', () => {
    const event = normalizeCitrineosWebhookPayload({
      eventType: 'Ended',
      seqNo: 4,
      transactionInfo: {
        transactionId: 'tx-ocpp2-1',
        remoteStartId: 77,
      },
      meterValue: [
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              value: '2500',
              unit: 'Wh',
            },
          ],
        },
      ],
    });
    assert.equal(event?.transactionId, 'tx-ocpp2-1');
    assert.equal(event?.remoteStartId, 77);
    assert.equal(event?.totalKwh, 2.5);
    assert.equal(event?.isActive, false);
    assert.equal(event?.eventType, 'Ended');
    assert.equal(event?.seqNo, 4);
  });

  it('still accepts flat 1.6-ish payloads', () => {
    const event = normalizeCitrineosWebhookPayload({
      transactionId: 'flat-1',
      isActive: true,
      totalKwh: 3.1,
      totalCost: 1.2,
    });
    assert.deepEqual(event, {
      transactionId: 'flat-1',
      remoteStartId: null,
      totalKwh: 3.1,
      totalCost: 1.2,
      isActive: true,
      eventType: null,
      seqNo: null,
      triggerReason: null,
      stationId: null,
    });
  });

  it('passes through triggerReason ChargingRateChanged for LM re-opt hooks', () => {
    const event = normalizeCitrineosWebhookPayload({
      eventType: 'Updated',
      triggerReason: 'ChargingRateChanged',
      stationId: 'cp-42',
      seqNo: 3,
      transactionInfo: { transactionId: 'tx-rate' },
      meterValue: [
        {
          sampledValue: [
            { measurand: 'Energy.Active.Import.Register', value: '1000', unit: 'Wh' },
          ],
        },
      ],
    });
    assert.equal(event?.transactionId, 'tx-rate');
    assert.equal(event?.triggerReason, 'ChargingRateChanged');
    assert.equal(event?.stationId, 'cp-42');
    assert.equal(event?.eventType, 'Updated');
    assert.equal(event?.totalKwh, 1);
    assert.equal(event?.isActive, true);
  });

  it('accepts ChargingRateChanged + stationId without energy/tx as re-opt signal', () => {
    const event = normalizeCitrineosWebhookPayload({
      trigger_reason: 'ChargingRateChanged',
      station_id: 'go-e-1',
    });
    assert.equal(event?.triggerReason, 'ChargingRateChanged');
    assert.equal(event?.stationId, 'go-e-1');
    assert.equal(event?.transactionId, null);
  });

  it('passes through Updated seqNo for offline-replay ordering', () => {
    const event = normalizeCitrineosWebhookPayload({
      eventType: 'Updated',
      seqNo: '12',
      transactionId: 'tx-seq',
      totalEnergyKwh: 1.25,
    });
    assert.equal(event?.eventType, 'Updated');
    assert.equal(event?.seqNo, 12);
    assert.equal(event?.totalKwh, 1.25);
  });

  it('rejects empty / no-signal payloads', () => {
    assert.equal(normalizeCitrineosWebhookPayload(null), null);
    assert.equal(normalizeCitrineosWebhookPayload({ foo: 1 }), null);
  });

  it('maps snake_case event_type Ended to isActive=false (session complete)', () => {
    const event = normalizeCitrineosWebhookPayload({
      event_type: 'Ended',
      transaction_id: 'tx-snake-end',
      seq_no: 9,
      total_kwh: 4.2,
    });
    assert.equal(event?.transactionId, 'tx-snake-end');
    assert.equal(event?.eventType, 'Ended');
    assert.equal(event?.seqNo, 9);
    assert.equal(event?.totalKwh, 4.2);
    assert.equal(event?.isActive, false);
  });

  it('maps nested chargingState Idle on Ended without flat isActive', () => {
    const event = normalizeCitrineosWebhookPayload({
      eventType: 'Ended',
      transactionInfo: {
        transactionId: 'tx-idle-end',
        chargingState: 'Idle',
      },
    });
    assert.equal(event?.transactionId, 'tx-idle-end');
    assert.equal(event?.isActive, false);
  });

  it('defaults missing energy unit to Wh (not kWh) and honors unitOfMeasure.multiplier', () => {
    const noUnit = normalizeCitrineosWebhookPayload({
      transactionId: 'tx-nounit',
      meterValue: [
        {
          sampledValue: [
            { measurand: 'Energy.Active.Import.Register', value: '3500' },
          ],
        },
      ],
    });
    assert.equal(noUnit?.totalKwh, 3.5);

    const withMultiplier = normalizeCitrineosWebhookPayload({
      transactionId: 'tx-mult',
      meterValue: [
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              value: '25',
              unitOfMeasure: { unit: 'Wh', multiplier: 2 }, // 25 × 10^2 = 2500 Wh
            },
          ],
        },
      ],
    });
    assert.equal(withMultiplier?.totalKwh, 2.5);

    const kwhExplicit = normalizeCitrineosWebhookPayload({
      transactionId: 'tx-kwh',
      meterValue: [
        {
          sampledValue: [
            {
              measurand: 'Energy.Active.Import.Register',
              value: '4.2',
              unitOfMeasure: { unit: 'kWh' },
            },
          ],
        },
      ],
    });
    assert.equal(kwhExplicit?.totalKwh, 4.2);
  });
});
