import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCitrineosWebhookAuthorized,
  resolveCitrineosWebhookSecret,
} from './citrineosWebhooks.mjs';

function mockReq(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    get(name) {
      return normalized[String(name).toLowerCase()] ?? undefined;
    },
  };
}

describe('resolveCitrineosWebhookSecret', () => {
  it('reads primary and alias env keys', () => {
    assert.equal(resolveCitrineosWebhookSecret({ CITRINEOS_WEBHOOK_SECRET: ' a ' }), 'a');
    assert.equal(
      resolveCitrineosWebhookSecret({ BC_CITRINEOS_WEBHOOK_SECRET: 'alias' }),
      'alias'
    );
    assert.equal(resolveCitrineosWebhookSecret({}), null);
  });
});

describe('assertCitrineosWebhookAuthorized', () => {
  it('allows open-dev when secret unset outside production', () => {
    const r = assertCitrineosWebhookAuthorized(mockReq(), { NODE_ENV: 'development' });
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'open-dev');
  });

  it('blocks production when secret unset', () => {
    const r = assertCitrineosWebhookAuthorized(mockReq(), { NODE_ENV: 'production' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
  });

  it('accepts Bearer secret', () => {
    const env = { NODE_ENV: 'production', CITRINEOS_WEBHOOK_SECRET: 'super-secret-value-32chars!!' };
    const r = assertCitrineosWebhookAuthorized(
      mockReq({ authorization: 'Bearer super-secret-value-32chars!!' }),
      env
    );
    assert.equal(r.ok, true);
    assert.equal(r.mode, 'secret');
  });

  it('accepts x-citrineos-webhook-secret header', () => {
    const env = { CITRINEOS_WEBHOOK_SECRET: 'hdr-secret-value-xxxxxxxx' };
    const r = assertCitrineosWebhookAuthorized(
      mockReq({ 'x-citrineos-webhook-secret': 'hdr-secret-value-xxxxxxxx' }),
      env
    );
    assert.equal(r.ok, true);
  });

  it('rejects wrong secret with 401', () => {
    const env = { CITRINEOS_WEBHOOK_SECRET: 'expected-secret-value-xxxx' };
    const r = assertCitrineosWebhookAuthorized(
      mockReq({ authorization: 'Bearer wrong-secret-value-yyyyyy' }),
      env
    );
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
  });

  it('rejects missing secret when configured', () => {
    const env = { CITRINEOS_WEBHOOK_SECRET: 'expected-secret-value-xxxx' };
    const r = assertCitrineosWebhookAuthorized(mockReq(), env);
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
  });
});
