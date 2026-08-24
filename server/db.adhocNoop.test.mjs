/**
 * Run: node --test server/db.adhocNoop.test.mjs
 * SQLite updateAdhocSession no-op parity with PG IS DISTINCT FROM.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = mkdtempSync(join(tmpdir(), 'bc-adhoc-noop-'));
const testDbPath = join(tmpDir, 'adhoc-noop.sqlite');

process.env.BC_DB_CLIENT = 'sqlite';
process.env.BC_DB_PATH = testDbPath;

const { initDb, insertAdhocSession, updateAdhocSession, getDbHandles } = await import('./db.mjs');

before(async () => {
  await initDb();
});

after(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore cleanup */
  }
});

function readAdhocRow(id) {
  const { sqliteDb } = getDbHandles();
  return sqliteDb
    .prepare('SELECT status, payment_intent_id, data_json, updated_at FROM adhoc_sessions WHERE id = ?')
    .get(id);
}

describe('updateAdhocSession SQLite no-op', () => {
  it('skips rewrite when status/data/payment_intent are unchanged', async () => {
    const session = {
      id: 'adhoc-noop-1',
      accessToken: 'tok-noop-1',
      stationId: 'ST-1',
      connectorId: 1,
      status: 'active',
      paymentIntentId: 'pi_same',
      kwh: 1.25,
    };
    await insertAdhocSession(session);
    const before = readAdhocRow(session.id);
    assert.ok(before);
    assert.equal(before.status, 'active');
    assert.equal(before.payment_intent_id, 'pi_same');

    // Identical payload again (poll/retry) — must not bump updated_at.
    await updateAdhocSession({ ...session });
    const afterSame = readAdhocRow(session.id);
    assert.equal(afterSame.updated_at, before.updated_at);
    assert.equal(afterSame.data_json, before.data_json);
    assert.equal(afterSame.status, before.status);
    assert.equal(afterSame.payment_intent_id, before.payment_intent_id);

    // Real change must write.
    await new Promise((r) => setTimeout(r, 5));
    await updateAdhocSession({ ...session, kwh: 2.5, status: 'active' });
    const afterChange = readAdhocRow(session.id);
    assert.notEqual(afterChange.updated_at, before.updated_at);
    assert.match(afterChange.data_json, /"kwh":2\.5/);
  });

  it('applies payment_intent when transitioning null → value; keeps on null next', async () => {
    const session = {
      id: 'adhoc-noop-2',
      accessToken: 'tok-noop-2',
      stationId: 'ST-2',
      connectorId: 2,
      status: 'pending',
      paymentIntentId: null,
      phase: 'wait',
    };
    await insertAdhocSession(session);
    const before = readAdhocRow(session.id);
    assert.equal(before.payment_intent_id, null);

    await updateAdhocSession({ ...session, paymentIntentId: null });
    const afterNull = readAdhocRow(session.id);
    assert.equal(afterNull.updated_at, before.updated_at);
    assert.equal(afterNull.payment_intent_id, null);

    await new Promise((r) => setTimeout(r, 5));
    await updateAdhocSession({ ...session, paymentIntentId: 'pi_new' });
    const afterPi = readAdhocRow(session.id);
    assert.equal(afterPi.payment_intent_id, 'pi_new');
    assert.notEqual(afterPi.updated_at, before.updated_at);

    // Null next must keep existing PI (COALESCE) and not force rewrite solely for null.
    const piUpdatedAt = afterPi.updated_at;
    await updateAdhocSession({ ...session, paymentIntentId: null });
    const afterKeep = readAdhocRow(session.id);
    assert.equal(afterKeep.payment_intent_id, 'pi_new');
    assert.equal(afterKeep.updated_at, piUpdatedAt);
  });

  it('writes when only status changes', async () => {
    const session = {
      id: 'adhoc-noop-3',
      accessToken: 'tok-noop-3',
      stationId: 'ST-3',
      connectorId: 1,
      status: 'active',
      paymentIntentId: 'pi_3',
    };
    await insertAdhocSession(session);
    const before = readAdhocRow(session.id);
    await new Promise((r) => setTimeout(r, 5));
    await updateAdhocSession({ ...session, status: 'completed' });
    const after = readAdhocRow(session.id);
    assert.equal(after.status, 'completed');
    assert.notEqual(after.updated_at, before.updated_at);
  });
});
