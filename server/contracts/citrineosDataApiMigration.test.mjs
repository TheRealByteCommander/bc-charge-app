/**
 * #849 /data/** migration matrix — unit tests.
 * Run: node --test server/contracts/citrineosDataApiMigration.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITRINEOS_DATA_API_MIGRATION,
  CITRINEOS_DATA_API_LEGACY_PREFIX,
  listDataApiCallSites,
  getDataApiMigrationEntry,
  evaluateDataApiMigrationReadiness,
  summarizeDataApiMigration,
} from './citrineosDataApiMigration.mjs';

describe('citrineosDataApiMigration matrix shape', () => {
  it('pins legacy prefix and upstream PR #849', () => {
    assert.equal(CITRINEOS_DATA_API_LEGACY_PREFIX, '/data/');
    assert.equal(CITRINEOS_DATA_API_MIGRATION.upstreamPr, 849);
    assert.match(CITRINEOS_DATA_API_MIGRATION.upstreamUrl, /\/849\b/);
    assert.equal(CITRINEOS_DATA_API_MIGRATION.pin, '1.8.4');
    assert.ok(Array.isArray(CITRINEOS_DATA_API_MIGRATION.routes));
    assert.ok(CITRINEOS_DATA_API_MIGRATION.routes.length >= 3);
  });

  it('covers known BC REST Data-API call sites', () => {
    const paths = CITRINEOS_DATA_API_MIGRATION.routes.map((r) => r.legacyPath);
    assert.ok(paths.includes('/data/transactions/transactionType'));
    assert.ok(paths.includes('/data/transactions/tariff'));
    assert.ok(paths.includes('/data/configuration/bootConfig'));
  });

  it('each route has callSites, fallback, target, and status', () => {
    for (const route of CITRINEOS_DATA_API_MIGRATION.routes) {
      assert.ok(route.id, 'id');
      assert.ok(route.legacyPath.startsWith('/data/'), route.id);
      assert.ok(Array.isArray(route.callSites) && route.callSites.length > 0, route.id);
      assert.ok(route.fallback && typeof route.fallback === 'object', route.id);
      assert.ok(typeof route.fallback.kind === 'string', route.id);
      assert.ok(typeof route.targetHint === 'string', route.id);
      assert.ok(
        ['hard_break', 'fallback_ready', 'unused_or_low', 'migrated'].includes(route.status),
        `${route.id} status=${route.status}`
      );
      assert.equal(typeof route.blocksPinBump, 'boolean', route.id);
    }
  });

  it('getTransaction is hard_break without REST replacement (Hasura only partial)', () => {
    const tx = getDataApiMigrationEntry('getTransaction');
    assert.ok(tx);
    assert.equal(tx.legacyPath, '/data/transactions/transactionType');
    assert.equal(tx.blocksPinBump, true);
    assert.ok(['hard_break', 'fallback_ready'].includes(tx.status));
  });

  it('listDataApiCallSites flattens file references', () => {
    const sites = listDataApiCallSites();
    assert.ok(sites.length >= 3);
    assert.ok(sites.some((s) => s.includes('citrineosServer.mjs')));
    assert.ok(sites.some((s) => s.includes('paths.ts') || s.includes('citrineos.mjs')));
  });
});

describe('evaluateDataApiMigrationReadiness', () => {
  it('is not ready while any route still blocks pin bump', () => {
    const r = evaluateDataApiMigrationReadiness();
    assert.equal(r.ready, false);
    assert.ok(r.blockers.length > 0);
    assert.ok(r.blockers.some((b) => b.includes('849') || b.includes('getTransaction') || b.includes('getTariffs') || b.includes('data')));
    assert.equal(r.upstreamPr, 849);
    assert.equal(r.legacyPrefix, '/data/');
  });

  it('summary exposes counts by status', () => {
    const s = summarizeDataApiMigration();
    assert.equal(typeof s.total, 'number');
    assert.ok(s.total >= 3);
    assert.equal(typeof s.blocking, 'number');
    assert.ok(s.blocking >= 1);
    assert.ok(s.byStatus && typeof s.byStatus === 'object');
    assert.ok(Array.isArray(s.blockingIds));
    assert.ok(s.blockingIds.includes('getTransaction') || s.blockingIds.includes('getTariffs'));
  });

  it('guidance forbids pin bump until matrix cleared', () => {
    const r = evaluateDataApiMigrationReadiness();
    assert.match(r.guidance, /pin|bump|1\.8\.4|#849|data/i);
  });
});
