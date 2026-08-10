import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCitrineosWebhookPayload } from './citrineosWebhooks.mjs';

describe('normalizeCitrineosWebhookPayload OCPP2 nested', () => {
  it('reads transactionId/remoteStartId from transactionInfo and energy from meterValue Wh', () => {
    const event = normalizeCitrineosWebhookPayload({
      eventType: 'Ended',
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
    });
  });

  it('rejects empty / no-signal payloads', () => {
    assert.equal(normalizeCitrineosWebhookPayload(null), null);
    assert.equal(normalizeCitrineosWebhookPayload({ foo: 1 }), null);
  });
});
