/**
 * Hasura WS BFF proxy helpers.
 * Run: node --test server/utils/hasuraWsProxy.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HASURA_WS_PATH,
  httpUrlToWsUrl,
  injectHasuraAdminSecretIntoClientFrame,
  isHasuraWsUpgradeRequest,
  resolveHasuraAdminSecret,
  resolveHasuraWsUpstream,
} from './hasuraWsProxy.mjs';

describe('httpUrlToWsUrl', () => {
  it('maps http/https Hasura GraphQL URLs to ws/wss', () => {
    assert.equal(
      httpUrlToWsUrl('http://127.0.0.1:8090/v1/graphql'),
      'ws://127.0.0.1:8090/v1/graphql'
    );
    assert.equal(
      httpUrlToWsUrl('https://hasura.example.com/v1/graphql'),
      'wss://hasura.example.com/v1/graphql'
    );
  });

  it('adds /v1/graphql when path missing', () => {
    assert.equal(httpUrlToWsUrl('http://localhost:8090'), 'ws://localhost:8090/v1/graphql');
  });

  it('passes through existing ws URLs', () => {
    assert.equal(httpUrlToWsUrl('ws://h/v1/graphql'), 'ws://h/v1/graphql');
  });

  it('returns empty on garbage', () => {
    assert.equal(httpUrlToWsUrl(''), '');
    assert.equal(httpUrlToWsUrl('not a url'), '');
  });
});

describe('resolveHasuraWsUpstream', () => {
  it('null when env unset', () => {
    assert.equal(resolveHasuraWsUpstream({}), null);
  });

  it('resolves from CITRINEOS_HASURA_URL', () => {
    assert.equal(
      resolveHasuraWsUpstream({ CITRINEOS_HASURA_URL: 'http://hasura:8080/v1/graphql' }),
      'ws://hasura:8080/v1/graphql'
    );
  });
});

describe('resolveHasuraAdminSecret', () => {
  it('trims and ignores empty', () => {
    assert.equal(resolveHasuraAdminSecret({}), undefined);
    assert.equal(resolveHasuraAdminSecret({ CITRINEOS_HASURA_ADMIN_SECRET: '  ' }), undefined);
    assert.equal(resolveHasuraAdminSecret({ CITRINEOS_HASURA_ADMIN_SECRET: ' s3cret ' }), 's3cret');
  });
});

describe('injectHasuraAdminSecretIntoClientFrame', () => {
  it('injects secret into empty connection_init', () => {
    const { forward, mutated } = injectHasuraAdminSecretIntoClientFrame(
      JSON.stringify({ type: 'connection_init', payload: {} }),
      'topsecret'
    );
    assert.equal(mutated, true);
    const parsed = JSON.parse(forward);
    assert.equal(parsed.type, 'connection_init');
    assert.equal(parsed.payload.headers['x-hasura-admin-secret'], 'topsecret');
  });

  it('does not overwrite existing secret', () => {
    const frame = JSON.stringify({
      type: 'connection_init',
      payload: { headers: { 'x-hasura-admin-secret': 'client-provided' } },
    });
    const { forward, mutated } = injectHasuraAdminSecretIntoClientFrame(frame, 'server');
    assert.equal(mutated, false);
    assert.equal(JSON.parse(forward).payload.headers['x-hasura-admin-secret'], 'client-provided');
  });

  it('leaves non-init frames untouched', () => {
    const frame = JSON.stringify({ id: '1', type: 'start', payload: { query: 'subscription { x }' } });
    const { forward, mutated } = injectHasuraAdminSecretIntoClientFrame(frame, 'secret');
    assert.equal(mutated, false);
    assert.equal(forward, frame);
  });

  it('no-ops without secret', () => {
    const frame = JSON.stringify({ type: 'connection_init', payload: {} });
    const { mutated } = injectHasuraAdminSecretIntoClientFrame(frame, undefined);
    assert.equal(mutated, false);
  });
});

describe('isHasuraWsUpgradeRequest', () => {
  it('matches default path', () => {
    assert.equal(
      isHasuraWsUpgradeRequest({ url: HASURA_WS_PATH, headers: { host: 'localhost' } }),
      true
    );
    assert.equal(
      isHasuraWsUpgradeRequest({ url: `${HASURA_WS_PATH}?x=1`, headers: { host: 'localhost' } }),
      true
    );
    assert.equal(
      isHasuraWsUpgradeRequest({ url: '/api/citrineos/hasura', headers: { host: 'localhost' } }),
      false
    );
  });
});
