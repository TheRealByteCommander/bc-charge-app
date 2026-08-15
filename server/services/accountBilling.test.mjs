import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_SETTLE_THRESHOLD_CENTS,
  buildCollectiveInvoiceSession,
  buildSessionLineItem,
  markSessionsDeferred,
  markSessionsSettled,
  sessionUsageCents,
  shouldSettleAccountCharges,
  sumUsageCents,
} from './accountBilling.mjs';

describe('accountBilling', () => {
  it('defers under threshold and settles at/above €1', () => {
    const current = { id: 'a', costEur: 0.03, energyKwh: 0.06, status: 'completed' };
    const open = [
      { id: 'b', costEur: 0.4, baseCostEur: 0.4, status: 'completed', billingStatus: 'deferred' },
      { id: 'c', usageCostEur: 0.5, status: 'completed', paymentStatus: 'deferred' },
    ];
    const low = shouldSettleAccountCharges({ deferredSessions: open, currentSession: current });
    // 0.4+0.5+0.03 = 0.93 < 1
    assert.equal(low.settle, false);
    assert.ok(low.totalCents < ACCOUNT_SETTLE_THRESHOLD_CENTS);

    const highCurrent = { id: 'd', costEur: 0.2, status: 'completed' };
    const high = shouldSettleAccountCharges({
      deferredSessions: open,
      currentSession: highCurrent,
    });
    // 0.4+0.5+0.2 = 1.10
    assert.equal(high.settle, true);
    assert.equal(high.totalCents, 110);
  });

  it('settles immediately when single session >= threshold', () => {
    const r = shouldSettleAccountCharges({
      deferredSessions: [],
      currentSession: { id: 'x', costEur: 1.25 },
    });
    assert.equal(r.settle, true);
    assert.equal(r.totalCents, 125);
  });

  it('builds collective invoice with per-session line items summing to total', () => {
    const sessions = [
      {
        id: 's1',
        stationName: 'Machern',
        connectorType: 'Type2',
        powerKw: 11,
        energyKwh: 0.5,
        pricePerKwh: 0.45,
        sessionFee: 0,
        costEur: 0.23,
        startedAt: '2026-08-15T18:00:00.000Z',
        endedAt: '2026-08-15T18:10:00.000Z',
      },
      {
        id: 's2',
        stationName: 'Leipzig',
        connectorType: 'CCS',
        powerKw: 50,
        energyKwh: 2,
        pricePerKwh: 0.45,
        costEur: 0.9,
        startedAt: '2026-08-15T19:00:00.000Z',
        endedAt: '2026-08-15T19:20:00.000Z',
      },
    ];
    const batch = buildCollectiveInvoiceSession({
      batchId: 'batch_1',
      sessions,
      totalEur: 1.13,
      stripePaymentIntentId: 'pi_test',
    });
    assert.equal(batch.invoiceKind, 'collective');
    assert.equal(batch.isCollectiveInvoice, true);
    assert.equal(batch.costEur, 1.13);
    assert.equal(batch.lineItems.length, 2);
    assert.equal(sumUsageCents(sessions), sessionUsageCents(sessions[0]) + sessionUsageCents(sessions[1]));
    const item = buildSessionLineItem(sessions[0]);
    assert.match(item.label, /Machern/);
  });

  it('marks deferred and settled shapes correctly', () => {
    const def = markSessionsDeferred(
      { id: 'm', costEur: 0.03, energyKwh: 0.06, status: 'completed' },
      { openBalanceCents: 53 }
    );
    assert.equal(def.paymentStatus, 'deferred');
    assert.equal(def.billingStatus, 'deferred');
    assert.equal(def.costEur, 0.03);
    assert.equal(def.amountChargedEur, 0);

    const settled = markSessionsSettled([def], {
      invoiceNumber: 'BC-2026-000099',
      batchId: 'batch_x',
      totalEur: 1.2,
      stripePaymentIntentId: 'pi_x',
      captureCents: 120,
    });
    assert.equal(settled[0].invoiceNumber, 'BC-2026-000099');
    assert.equal(settled[0].billingStatus, 'invoiced');
    assert.equal(settled[0].batchTotalEur, 1.2);
  });
});
