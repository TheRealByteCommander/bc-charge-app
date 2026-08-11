/**
 * Run: node --test server/services/loadManagementClient.test.mjs
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLoadManagementApiBase,
  getLoadManagementHealthBase,
  getLoadManagementApiKey,
  isLoadManagementEnabled,
} from './loadManagementClient.mjs';

const KEYS = [
  'LOAD_MANAGEMENT_DISABLED',
  'LM_DISABLED',
  'LOAD_MANAGEMENT_ENABLED',
  'LM_ENABLED',
  'LOAD_MANAGEMENT_API_URL',
  'LM_API_URL',
  'LOAD_MANAGEMENT_HEALTH_URL',
  'LM_HEALTH_URL',
  'LM_API_KEY',
  'LOAD_MANAGEMENT_API_KEY',
];

beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe('loadManagementClient config', () => {
  it('defaults API/health bases', () => {
    assert.equal(getLoadManagementApiBase({}), 'http://127.0.0.1:3003');
    assert.equal(getLoadManagementHealthBase({}), 'http://127.0.0.1:3001');
  });

  it('reads API key aliases', () => {
    assert.equal(getLoadManagementApiKey({}), undefined);
    assert.equal(getLoadManagementApiKey({ LM_API_KEY: 'abc' }), 'abc');
    assert.equal(
      getLoadManagementApiKey({ LOAD_MANAGEMENT_API_KEY: 'xyz' }),
      'xyz'
    );
  });

  it('enabled when flag or URL or key present', () => {
    assert.equal(isLoadManagementEnabled({}), false);
    assert.equal(isLoadManagementEnabled({ LM_ENABLED: '1' }), true);
    assert.equal(
      isLoadManagementEnabled({ LOAD_MANAGEMENT_API_URL: 'http://lm:3003' }),
      true
    );
    assert.equal(isLoadManagementEnabled({ LM_API_KEY: 'k' }), true);
  });

  it('disabled wins over enable flags', () => {
    assert.equal(
      isLoadManagementEnabled({
        LM_ENABLED: '1',
        LM_API_KEY: 'k',
        LOAD_MANAGEMENT_DISABLED: '1',
      }),
      false
    );
  });
});
