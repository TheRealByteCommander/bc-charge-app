import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCaptureCents,
  getPreauthCents,
  isAuthorizedForStart,
  mapPaymentStatusFromIntent,
} from './stripePreauth.mjs';

describe('stripePreauth', () => {
  it('defaults preauth to 5000 cents (€50)', () => {
    const prev = process.env.BC_PREAUTH_CENTS;
    delete process.env.BC_PREAUTH_CENTS;
    delete process.env.BC_ADHOC_PREAUTH_CENTS;
    assert.equal(getPreauthCents(), 5000);
    if (prev !== undefined) process.env.BC_PREAUTH_CENTS = prev;
  });

  it('clamps preauth between 5€ and 250€', () => {
    process.env.BC_PREAUTH_CENTS = '100';
    assert.equal(getPreauthCents(), 500);
    process.env.BC_PREAUTH_CENTS = '999999';
    assert.equal(getPreauthCents(), 25_000);
    delete process.env.BC_PREAUTH_CENTS;
  });

  it('captures actual usage capped by hold', () => {
    assert.equal(computeCaptureCents(12.34, 5000), 1234);
    assert.equal(computeCaptureCents(80, 5000), 5000);
    assert.equal(computeCaptureCents(0, 5000), 0);
    assert.equal(computeCaptureCents(0.3, 5000), 50);
  });

  it('allows start only when authorized or already succeeded', () => {
    assert.equal(isAuthorizedForStart('requires_capture'), true);
    assert.equal(isAuthorizedForStart('succeeded'), true);
    assert.equal(isAuthorizedForStart('requires_payment_method'), false);
    assert.equal(isAuthorizedForStart('canceled'), false);
  });

  it('maps intent status to session paymentStatus', () => {
    assert.equal(mapPaymentStatusFromIntent('succeeded'), 'paid');
    assert.equal(mapPaymentStatusFromIntent('processing'), 'pending');
    assert.equal(mapPaymentStatusFromIntent('requires_capture'), 'pending');
    assert.equal(mapPaymentStatusFromIntent('canceled'), 'skipped');
    assert.equal(mapPaymentStatusFromIntent('requires_action'), 'failed');
  });
});
