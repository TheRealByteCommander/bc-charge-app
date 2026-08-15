/**
 * #849 dual-path helpers — unit tests.
 * Run: node --test server/utils/citrineosDataApiPaths.test.mjs
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITRINEOS_DATA_API_PATHS,
  resolveCitrineosRestSurface,
  resolveDataApiPathCandidates,
  resolvePrimaryDataApiPath,
  citrineosDualGet,
  citrineosDualFetchJson,
} from './citrineosDataApiPaths.mjs';

describe('resolveCitrineosRestSurface', () => {
  it('defaults to auto', () => {
    assert.equal(resolveCitrineosRestSurface({}), 'auto');
    assert.equal(resolveCitrineosRestSurface({ CITRINEOS_REST_SURFACE: '' }), 'auto');
  });

  it('accepts legacy and commands aliases', () => {
    assert.equal(resolveCitrineosRestSurface({ CITRINEOS_REST_SURFACE: 'legacy' }), 'legacy');
    assert.equal(resolveCitrineosRestSurface({ CITRINEOS_REST_SURFACE: 'data' }), 'legacy');
    assert.equal(resolveCitrineosRestSurface({ CITRINEOS_REST_SURFACE: 'commands' }), 'commands');
    assert.equal(resolveCitrineosRestSurface({ CITRINEOS_REST_SURFACE: 'v2' }), 'commands');
  });
});

describe('resolveDataApiPathCandidates', () => {
  it('maps #849 merge-spec command paths', () => {
    assert.equal(CITRINEOS_DATA_API_PATHS.getTransaction.commands, '/commands/transaction');
    assert.equal(CITRINEOS_DATA_API_PATHS.getTariffs.commands, '/commands/tariff');
    assert.equal(CITRINEOS_DATA_API_PATHS.getBootConfig.commands, '/commands/bootConfig');
  });

  it('auto prefers legacy then commands (and transaction alt)', () => {
    const tx = resolveDataApiPathCandidates('getTransaction', { surface: 'auto' });
    assert.deepEqual(tx, [
      '/data/transactions/transactionType',
      '/data/transactions/transaction',
      '/commands/transaction',
    ]);
    const tariffs = resolveDataApiPathCandidates('getTariffs', { surface: 'auto' });
    assert.deepEqual(tariffs, ['/data/transactions/tariff', '/commands/tariff']);
  });

  it('legacy-only omits commands', () => {
    const tx = resolveDataApiPathCandidates('getTransaction', { surface: 'legacy' });
    assert.ok(tx.every((p) => p.startsWith('/data/')));
    assert.ok(!tx.includes('/commands/transaction'));
  });

  it('commands-only is single path', () => {
    assert.deepEqual(resolveDataApiPathCandidates('getTariffs', { surface: 'commands' }), [
      '/commands/tariff',
    ]);
    assert.equal(resolvePrimaryDataApiPath('getBootConfig', { surface: 'commands' }), '/commands/bootConfig');
  });
});

describe('citrineosDualGet', () => {
  it('returns first non-null candidate', async () => {
    const getter = mock.fn(async (path) => (path.includes('commands') ? { id: 1 } : null));
    const r = await citrineosDualGet(getter, ['/data/x', '/commands/x'], { tenantId: 1 });
    assert.equal(r.path, '/commands/x');
    assert.deepEqual(r.data, { id: 1 });
    assert.deepEqual(r.tried, ['/data/x', '/commands/x']);
    assert.equal(getter.mock.calls.length, 2);
  });

  it('stops at first hit', async () => {
    const getter = mock.fn(async () => ({ ok: true }));
    const r = await citrineosDualGet(getter, ['/data/x', '/commands/x']);
    assert.equal(r.path, '/data/x');
    assert.equal(getter.mock.calls.length, 1);
  });
});

describe('citrineosDualFetchJson', () => {
  it('falls through 404 to commands path', async () => {
    const fetchImpl = mock.fn(async (url) => {
      if (String(url).includes('/data/')) {
        return {
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ error: 'gone' }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 't1' }]),
      };
    });
    const r = await citrineosDualFetchJson(
      'http://citrine.local',
      ['/data/transactions/tariff', '/commands/tariff'],
      { tenantId: 1 },
      { fetchImpl }
    );
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
    assert.equal(r.path, '/commands/tariff');
    assert.deepEqual(r.data, [{ id: 't1' }]);
    assert.equal(fetchImpl.mock.calls.length, 2);
  });

  it('does not retry non-404 errors', async () => {
    const fetchImpl = mock.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: 'boom' }),
    }));
    const r = await citrineosDualFetchJson(
      'http://citrine.local',
      ['/data/transactions/tariff', '/commands/tariff'],
      {},
      { fetchImpl }
    );
    assert.equal(r.ok, false);
    assert.equal(r.status, 500);
    assert.equal(r.path, '/data/transactions/tariff');
    assert.equal(fetchImpl.mock.calls.length, 1);
  });
});
