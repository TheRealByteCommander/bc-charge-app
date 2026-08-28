/**
 * Run: node --test server/db.fulfillmentNoop.test.mjs
 * SQLite markFulfillmentUsed no-op parity with PG IS DISTINCT FROM.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = mkdtempSync(join(tmpdir(), 'bc-fulfillment-noop-'));
const testDbPath = join(tmpDir, 'fulfillment-noop.sqlite');

process.env.BC_DB_CLIENT = 'sqlite';
process.env.BC_DB_PATH = testDbPath;

const {
  initDb,
  insertUser,
  insertFulfillment,
  markFulfillmentUsed,
  getFulfillmentById,
  getDbHandles,
} = await import('./db.mjs');

before(async () => {
  await initDb();
});

async function seedUser(id) {
  await insertUser({
    id,
    email: `${id}@example.test`,
    passwordHash: 'test-hash',
    profile: { displayName: id },
  });
}

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore cleanup */
  }
});

function readFulfillmentRow(id) {
  const { sqliteDb } = getDbHandles();
  return sqliteDb
    .prepare(
      'SELECT status, used_at, session_id FROM reward_fulfillments WHERE id = ?'
    )
    .get(id);
}

describe('markFulfillmentUsed SQLite no-op', () => {
  it('first mark writes used; identical retry keeps used_at/session_id', async () => {
    await seedUser('user-noop-1');
    const fulfillment = {
      id: 'ff-noop-1',
      userId: 'user-noop-1',
      rewardId: 'rw_free_kwh',
      type: 'free_kwh',
      status: 'active',
      payload: { freeKwh: 5 },
      redeemedAt: new Date().toISOString(),
      expiresAt: null,
    };
    await insertFulfillment(fulfillment);

    const first = await markFulfillmentUsed(fulfillment.userId, fulfillment.id, 'sess_a');
    assert.equal(first?.status, 'used');
    assert.equal(first?.sessionId, 'sess_a');
    assert.ok(first?.usedAt);
    const before = readFulfillmentRow(fulfillment.id);

    await new Promise((r) => setTimeout(r, 5));
    await markFulfillmentUsed(fulfillment.userId, fulfillment.id, 'sess_a');
    const afterSame = readFulfillmentRow(fulfillment.id);
    assert.equal(afterSame.status, 'used');
    assert.equal(afterSame.session_id, 'sess_a');
    assert.equal(afterSame.used_at, before.used_at);

    // null sessionId on retry must keep existing session_id and not rewrite.
    await markFulfillmentUsed(fulfillment.userId, fulfillment.id, null);
    const afterNull = readFulfillmentRow(fulfillment.id);
    assert.equal(afterNull.session_id, 'sess_a');
    assert.equal(afterNull.used_at, before.used_at);
  });

  it('allows session_id stamp when previously used without session', async () => {
    await seedUser('user-noop-2');
    const fulfillment = {
      id: 'ff-noop-2',
      userId: 'user-noop-2',
      rewardId: 'rw_discount',
      type: 'energy_discount',
      status: 'active',
      payload: { discountPercent: 10 },
      redeemedAt: new Date().toISOString(),
      expiresAt: null,
    };
    await insertFulfillment(fulfillment);

    await markFulfillmentUsed(fulfillment.userId, fulfillment.id, null);
    const before = readFulfillmentRow(fulfillment.id);
    assert.equal(before.status, 'used');
    assert.equal(before.session_id, null);

    await new Promise((r) => setTimeout(r, 5));
    await markFulfillmentUsed(fulfillment.userId, fulfillment.id, 'sess_b');
    const after = readFulfillmentRow(fulfillment.id);
    assert.equal(after.session_id, 'sess_b');
    // First used_at preserved when only session_id is stamped later.
    assert.equal(after.used_at, before.used_at);

    const domain = await getFulfillmentById(fulfillment.userId, fulfillment.id);
    assert.equal(domain?.sessionId, 'sess_b');
    assert.equal(domain?.status, 'used');
  });
});
