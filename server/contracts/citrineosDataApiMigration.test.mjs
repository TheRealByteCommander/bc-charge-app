/**
 * #849 /data/** migration matrix — unit tests.
 * Run: node --test server/contracts/citrineosDataApiMigration.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITRINEOS_DATA_API_MIGRATION,
  CITRINEOS_DATA_API_LEGACY_PREFIX,
  CITRINEOS_COMMANDS_PREFIX,
  listDataApiCallSites,
  getDataApiMigrationEntry,
  evaluateDataApiMigrationReadiness,
  summarizeDataApiMigration,
} from './citrineosDataApiMigration.mjs';

describe('citrineosDataApiMigration matrix shape', () => {
  it('pins legacy prefix, commands prefix, and upstream PR #849', () => {
    assert.equal(CITRINEOS_DATA_API_LEGACY_PREFIX, '/data/');
    assert.equal(CITRINEOS_COMMANDS_PREFIX, '/commands/');
    assert.equal(CITRINEOS_DATA_API_MIGRATION.upstreamPr, 849);
    assert.match(CITRINEOS_DATA_API_MIGRATION.upstreamUrl, /\/849\b/);
    assert.equal(CITRINEOS_DATA_API_MIGRATION.pin, '1.8.4');
    assert.ok(Array.isArray(CITRINEOS_DATA_API_MIGRATION.routes));
    assert.ok(CITRINEOS_DATA_API_MIGRATION.routes.length >= 3);
  });

  it('covers known BC REST Data-API call sites + #849 command targets', () => {
    const paths = CITRINEOS_DATA_API_MIGRATION.routes.map((r) => r.legacyPath);
    assert.ok(paths.includes('/data/transactions/transactionType'));
    assert.ok(paths.includes('/data/transactions/tariff'));
    assert.ok(paths.includes('/data/configuration/bootConfig'));
    const commands = CITRINEOS_DATA_API_MIGRATION.routes.map((r) => r.commandsPath);
    assert.ok(commands.includes('/commands/transaction'));
    assert.ok(commands.includes('/commands/tariff'));
    assert.ok(commands.includes('/commands/bootConfig'));
  });

  it('each route has callSites, fallback, target, dual_path status', () => {
    for (const route of CITRINEOS_DATA_API_MIGRATION.routes) {
      assert.ok(route.id, 'id');
      assert.ok(route.legacyPath.startsWith('/data/'), route.id);
      assert.ok(route.commandsPath.startsWith('/commands/'), route.id);
      assert.ok(Array.isArray(route.callSites) && route.callSites.length > 0, route.id);
      assert.ok(route.fallback && typeof route.fallback === 'object', route.id);
      assert.ok(typeof route.fallback.kind === 'string', route.id);
      assert.ok(typeof route.targetHint === 'string', route.id);
      assert.ok(
        ['hard_break', 'fallback_ready', 'unused_or_low', 'migrated', 'dual_path'].includes(
          route.status
        ),
        `${route.id} status=${route.status}`
      );
      assert.equal(typeof route.blocksPinBump, 'boolean', route.id);
    }
  });

  it('getTransaction is dual_path to /commands/transaction (no longer hard_break)', () => {
    const tx = getDataApiMigrationEntry('getTransaction');
    assert.ok(tx);
    assert.equal(tx.legacyPath, '/data/transactions/transactionType');
    assert.equal(tx.commandsPath, '/commands/transaction');
    assert.equal(tx.blocksPinBump, false);
    assert.equal(tx.status, 'dual_path');
  });

  it('listDataApiCallSites flattens file references', () => {
    const sites = listDataApiCallSites();
    assert.ok(sites.length >= 3);
    assert.ok(sites.some((s) => s.includes('citrineosServer.mjs')));
    assert.ok(sites.some((s) => s.includes('paths.ts') || s.includes('citrineos.mjs')));
  });
});

describe('evaluateDataApiMigrationReadiness', () => {
  it('is ready after dual-path wiring (structural #849 path gate clear)', () => {
    const r = evaluateDataApiMigrationReadiness();
    assert.equal(r.ready, true);
    assert.equal(r.blockers.length, 0);
    assert.equal(r.upstreamPr, 849);
    assert.equal(r.legacyPrefix, '/data/');
    assert.equal(r.commandsPrefix, '/commands/');
    assert.ok(r.dualPathRouteIds.includes('getTransaction'));
    assert.ok(r.dualPathRouteIds.includes('getTariffs'));
  });

  it('summary exposes dual_path counts and zero blocking', () => {
    const s = summarizeDataApiMigration();
    assert.equal(typeof s.total, 'number');
    assert.ok(s.total >= 3);
    assert.equal(s.blocking, 0);
    assert.deepEqual(s.blockingIds, []);
    assert.ok(s.byStatus && typeof s.byStatus === 'object');
    assert.ok((s.byStatus.dual_path ?? 0) >= 3);
    assert.equal(s.commandsPrefix, '/commands/');
  });

  it('guidance still requires soak before pin bump', () => {
    const r = evaluateDataApiMigrationReadiness();
    assert.match(r.guidance, /soak|pin|bump|1\.8\.4|#849|dual|commands/i);
    assert.match(r.guidance, /merged|next|commands/i);
  });
});
