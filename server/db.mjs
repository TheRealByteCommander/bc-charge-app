import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  assertCanActivateSession,
  assertSingleActiveInPayload,
  formatConcurrentSessionError,
} from './services/sessionGuard.mjs';
import { safeParseJson } from './utils/safeJson.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.BC_DB_PATH ?? resolve(root, 'data', 'bc-charge.sqlite');
const dbClient = (process.env.BC_DB_CLIENT ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();

let sqliteDb;
let pgPool;

export function isPostgres() {
  return dbClient === 'postgres';
}

/** Live bindings — assigned in initDb(); call initDb before using. */
export { sqliteDb, pgPool };

/** Document columns (data_json / profile_json / payload_json) — never throw on corrupt rows. */
function parseJson(value) {
  return safeParseJson(value, null);
}

export async function initDb() {
  if (isPostgres()) {
    if (pgPool) return pgPool;
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.BC_DB_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.BC_DB_POOL_IDLE_MS ?? 30_000),
      ssl: process.env.BC_DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        stripe_customer_id TEXT,
        profile_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS charging_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data_json JSONB NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON charging_sessions(user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_active_per_user
        ON charging_sessions(user_id) WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS redeemed_rewards (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_id TEXT NOT NULL,
        redeemed_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, reward_id)
      );

      CREATE TABLE IF NOT EXISTS reward_fulfillments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        payload_json JSONB NOT NULL,
        redeemed_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ,
        session_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user ON reward_fulfillments(user_id);
      CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user_status ON reward_fulfillments(user_id, status);

      CREATE TABLE IF NOT EXISTS adhoc_sessions (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        station_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_intent_id TEXT,
        data_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_adhoc_sessions_station ON adhoc_sessions(station_id);

      CREATE TABLE IF NOT EXISTS invoice_counters (
        year INTEGER PRIMARY KEY,
        last_number INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS invoice_registry (
        invoice_number TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invoice_registry_user ON invoice_registry(user_id);
    `);
    const { initPricingTables } = await import('./services/pricing/repository.mjs');
    await initPricingTables();
    return pgPool;
  }

  if (sqliteDb) return sqliteDb;
  mkdirSync(dirname(dbPath), { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  
  // Note: app_config will be initialized in configService.mjs or separately.
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT,
      profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS charging_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON charging_sessions(user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_active_per_user
      ON charging_sessions(user_id) WHERE status = 'active';

    CREATE TABLE IF NOT EXISTS redeemed_rewards (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, reward_id)
    );

    CREATE TABLE IF NOT EXISTS reward_fulfillments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payload_json TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      expires_at TEXT,
      used_at TEXT,
      session_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user ON reward_fulfillments(user_id);
    CREATE INDEX IF NOT EXISTS idx_reward_fulfillments_user_status ON reward_fulfillments(user_id, status);

    CREATE TABLE IF NOT EXISTS adhoc_sessions (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      station_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_intent_id TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_adhoc_sessions_station ON adhoc_sessions(station_id);

    CREATE TABLE IF NOT EXISTS invoice_counters (
      year INTEGER PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoice_registry (
      invoice_number TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_registry_user ON invoice_registry(user_id);
  `);
  const { initPricingTables } = await import('./services/pricing/repository.mjs');
  await initPricingTables();
  return sqliteDb;
}

export function getDbHandles() {
  return { isPostgres: isPostgres(), pgPool, sqliteDb };
}

function normalizeLoyaltyTier(value, points = 0) {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'platinum') {
    return value;
  }
  // Recover from historic bug: un-awaited async computeTier serialized as {}
  if (typeof points === 'number' && Number.isFinite(points)) {
    if (points >= 8000) return 'platinum';
    if (points >= 4000) return 'gold';
    if (points >= 1500) return 'silver';
  }
  return 'bronze';
}

export function rowToProfile(row) {
  const profile = parseJson(row.profile_json) ?? {};
  const points = Number(profile.loyaltyPoints ?? 0);
  return {
    ...profile,
    id: row.id,
    email: row.email,
    stripeCustomerId: row.stripe_customer_id ?? profile.stripeCustomerId,
    passwordHash: '',
    loyaltyPoints: Number.isFinite(points) ? points : 0,
    loyaltyTier: normalizeLoyaltyTier(profile.loyaltyTier, points),
  };
}

export async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (isPostgres()) {
    const { rows } = await pgPool.query('SELECT * FROM users WHERE email = $1', [normalized]);
    return rows[0] ?? null;
  }
  const row = sqliteDb
    .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .get(normalized);
  return row ?? null;
}

export async function findUserById(id) {
  if (isPostgres()) {
    const { rows } = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  }
  const row = sqliteDb.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ?? null;
}

export async function insertUser({ id, email, passwordHash, profile, stripeCustomerId }) {
  const now = new Date().toISOString();
  const normalizedEmail = email.toLowerCase();
  const profileJson = { ...profile, id, email: normalizedEmail, stripeCustomerId };
  if (isPostgres()) {
    await pgPool.query(
      `INSERT INTO users (id, email, password_hash, stripe_customer_id, profile_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [id, normalizedEmail, passwordHash, stripeCustomerId ?? null, JSON.stringify(profileJson), now, now]
    );
    return;
  }
  sqliteDb
    .prepare(
      `INSERT INTO users (id, email, password_hash, stripe_customer_id, profile_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, normalizedEmail, passwordHash, stripeCustomerId ?? null, JSON.stringify(profileJson), now, now);
}

export async function updateUserProfile(userId, profile, stripeCustomerId) {
  const now = new Date().toISOString();
  const row = await findUserById(userId);
  if (!row) return false;
  const merged = {
    ...parseJson(row.profile_json),
    ...profile,
    id: userId,
    email: row.email,
  };
  if (stripeCustomerId !== undefined) {
    merged.stripeCustomerId = stripeCustomerId;
  }
  const profileJson = JSON.stringify(merged);
  if (isPostgres()) {
    // Skip no-op profile rewrites (chatty gamification/loyalty paths) — lock still taken if row matches id.
    await pgPool.query(
      `UPDATE users
       SET profile_json = $1::jsonb,
           stripe_customer_id = COALESCE($2, stripe_customer_id),
           updated_at = $3
       WHERE id = $4
         AND (
           profile_json IS DISTINCT FROM $1::jsonb
           OR ($2::text IS NOT NULL AND stripe_customer_id IS DISTINCT FROM $2)
         )`,
      [profileJson, stripeCustomerId ?? null, now, userId]
    );
    return true;
  }
  const prevProfile = typeof row.profile_json === 'string' ? row.profile_json : JSON.stringify(row.profile_json ?? null);
  const prevStripe = row.stripe_customer_id ?? null;
  const nextStripe = stripeCustomerId !== undefined ? stripeCustomerId ?? null : prevStripe;
  if (prevProfile === profileJson && prevStripe === nextStripe) {
    return true;
  }
  sqliteDb
    .prepare(
      `UPDATE users SET profile_json = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), updated_at = ? WHERE id = ?`
    )
    .run(profileJson, stripeCustomerId ?? null, now, userId);
  return true;
}

export async function updateUserPassword(userId, passwordHash) {
  const now = new Date().toISOString();
  if (isPostgres()) {
    await pgPool.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      passwordHash,
      now,
      userId,
    ]);
    return;
  }
  sqliteDb
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, now, userId);
}

export async function deleteUser(userId) {
  if (isPostgres()) {
    await pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
    return;
  }
  sqliteDb.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export async function listSessions(userId) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      'SELECT data_json FROM charging_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows.map((r) => parseJson(r.data_json)).filter(Boolean);
  }
  const rows = sqliteDb
    .prepare('SELECT data_json FROM charging_sessions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  return rows.map((r) => parseJson(r.data_json)).filter(Boolean);
}

export async function findActiveSessionForUser(userId, excludeSessionId = null) {
  if (isPostgres()) {
    const params = [userId];
    let sql = `SELECT data_json FROM charging_sessions WHERE user_id = $1 AND status = 'active'`;
    if (excludeSessionId) {
      sql += ' AND id != $2';
      params.push(excludeSessionId);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    const { rows } = await pgPool.query(sql, params);
    return rows[0] ? parseJson(rows[0].data_json) : null;
  }

  const rows = sqliteDb
    .prepare(
      `SELECT data_json FROM charging_sessions
       WHERE user_id = ? AND status = 'active'${excludeSessionId ? ' AND id != ?' : ''}
       ORDER BY updated_at DESC LIMIT 1`
    )
    .all(...(excludeSessionId ? [userId, excludeSessionId] : [userId]));
  return rows[0] ? parseJson(rows[0].data_json) : null;
}

export async function findSessionById(userId, sessionId) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      'SELECT data_json FROM charging_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    return rows[0] ? parseJson(rows[0].data_json) : null;
  }
  const row = sqliteDb
    .prepare('SELECT data_json FROM charging_sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, userId);
  return row ? parseJson(row.data_json) : null;
}

/** Completed sessions still awaiting batch settlement (under €1 micro-billing). */
export async function listDeferredSessions(userId) {
  const sessions = await listSessions(userId);
  return sessions.filter((s) => {
    if (!s || s.status !== 'completed') return false;
    // Zero-usage / explicitly waived sessions never belong in the open balance queue.
    if (s.billingStatus === 'waived' || s.billingStatus === 'invoiced') return false;
    if (s.billingStatus === 'deferred' || s.paymentStatus === 'deferred') {
      const usage =
        s.usageCostEur != null
          ? Number(s.usageCostEur)
          : s.baseCostEur != null
            ? Number(s.baseCostEur)
            : Number(s.costEur);
      // Guard: deferred with 0€ usage is data drift — exclude from open balance.
      if (Number.isFinite(usage) && usage <= 0) return false;
      return true;
    }
    // Legacy micro sessions without invoice / card charge
    const usage =
      s.usageCostEur != null
        ? Number(s.usageCostEur)
        : s.baseCostEur != null
          ? Number(s.baseCostEur)
          : Number(s.costEur);
    if (
      !s.invoiceNumber &&
      !s.amountChargedEur &&
      Number.isFinite(usage) &&
      usage > 0 &&
      usage < 1 &&
      (s.paymentStatus === 'skipped' || s.paymentStatus === 'pending' || !s.paymentStatus)
    ) {
      return true;
    }
    return false;
  });
}

export async function upsertSession(userId, session) {
  await assertCanActivateSession(userId, session);

  const now = new Date().toISOString();
  const dataJson = JSON.stringify(session);
  try {
    if (isPostgres()) {
      // Skip no-op updates (IS DISTINCT FROM) to cut WAL/bloat on high-frequency session ticks.
      await pgPool.query(
        `INSERT INTO charging_sessions (id, user_id, data_json, status, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE
         SET data_json = EXCLUDED.data_json,
             status = EXCLUDED.status,
             updated_at = EXCLUDED.updated_at
         WHERE charging_sessions.data_json IS DISTINCT FROM EXCLUDED.data_json
            OR charging_sessions.status IS DISTINCT FROM EXCLUDED.status`,
        [session.id, userId, dataJson, session.status, session.startedAt ?? now, now]
      );
      return;
    }
    const existing = sqliteDb
      .prepare('SELECT id FROM charging_sessions WHERE id = ? AND user_id = ?')
      .get(session.id, userId);
    if (existing) {
      sqliteDb
        .prepare('UPDATE charging_sessions SET data_json = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(dataJson, session.status, now, session.id);
    } else {
      sqliteDb
        .prepare(
          `INSERT INTO charging_sessions (id, user_id, data_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(session.id, userId, dataJson, session.status, session.startedAt ?? now, now);
    }
  } catch (e) {
    if (isUniqueActiveSessionViolation(e)) {
      const existing = await findActiveSessionForUser(userId, session.id);
      throw Object.assign(new Error(formatConcurrentSessionError(existing)), {
        status: 409,
        code: 'CONCURRENT_SESSION',
        activeSession: existing,
      });
    }
    throw e;
  }
}

function isUniqueActiveSessionViolation(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  if (String(err.message ?? '').includes('idx_sessions_one_active_per_user')) return true;
  if (String(err.message ?? '').includes('UNIQUE constraint failed')) return true;
  return false;
}

export async function replaceSessions(userId, sessions) {
  assertSingleActiveInPayload(sessions);
  const active = sessions.find((s) => s?.status === 'active');
  if (active) {
    await assertCanActivateSession(userId, active);
  }

  if (isPostgres()) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM charging_sessions WHERE user_id = $1', [userId]);
      for (const session of sessions) {
        await client.query(
          `INSERT INTO charging_sessions (id, user_id, data_json, status, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
          [
            session.id,
            userId,
            JSON.stringify(session),
            session.status,
            session.startedAt ?? new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  const tx = sqliteDb.transaction((list) => {
    sqliteDb.prepare('DELETE FROM charging_sessions WHERE user_id = ?').run(userId);
    for (const session of list) {
      upsertSession(userId, session);
    }
  });
  tx(sessions);
}

export async function listRedeemed(userId) {
  if (isPostgres()) {
    const { rows } = await pgPool.query('SELECT reward_id FROM redeemed_rewards WHERE user_id = $1', [userId]);
    return rows.map((r) => r.reward_id);
  }
  return sqliteDb
    .prepare('SELECT reward_id FROM redeemed_rewards WHERE user_id = ?')
    .all(userId)
    .map((r) => r.reward_id);
}

export async function addRedeemed(userId, rewardId) {
  const now = new Date().toISOString();
  if (isPostgres()) {
    await pgPool.query(
      `INSERT INTO redeemed_rewards (user_id, reward_id, redeemed_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, reward_id) DO NOTHING`,
      [userId, rewardId, now]
    );
    return;
  }
  sqliteDb
    .prepare('INSERT OR IGNORE INTO redeemed_rewards (user_id, reward_id, redeemed_at) VALUES (?, ?, ?)')
    .run(userId, rewardId, now);
}

export async function setRedeemed(userId, rewardIds) {
  if (isPostgres()) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM redeemed_rewards WHERE user_id = $1', [userId]);
      for (const rewardId of rewardIds) {
        await client.query(
          `INSERT INTO redeemed_rewards (user_id, reward_id, redeemed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, reward_id) DO NOTHING`,
          [userId, rewardId, new Date().toISOString()]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  const tx = sqliteDb.transaction((ids) => {
    sqliteDb.prepare('DELETE FROM redeemed_rewards WHERE user_id = ?').run(userId);
    for (const rewardId of ids) {
      sqliteDb
        .prepare('INSERT OR IGNORE INTO redeemed_rewards (user_id, reward_id, redeemed_at) VALUES (?, ?, ?)')
        .run(userId, rewardId, new Date().toISOString());
    }
  });
  tx(rewardIds);
}

function computeTier(points) {
  if (points >= 8000) return 'platinum';
  if (points >= 4000) return 'gold';
  if (points >= 1500) return 'silver';
  return 'bronze';
}

const tierLabels = {
  bronze: 'Bronze',
  silver: 'Silber',
  gold: 'Gold',
  platinum: 'Platin',
};

export async function insertAdhocSession(session) {
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(session);
  if (isPostgres()) {
    await pgPool.query(
      `INSERT INTO adhoc_sessions (id, access_token, station_id, connector_id, status, payment_intent_id, data_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        session.id,
        session.accessToken,
        session.stationId,
        session.connectorId,
        session.status,
        session.paymentIntentId ?? null,
        dataJson,
        now,
        now,
      ]
    );
    return session;
  }
  sqliteDb
    .prepare(
      `INSERT INTO adhoc_sessions (id, access_token, station_id, connector_id, status, payment_intent_id, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.id,
      session.accessToken,
      session.stationId,
      session.connectorId,
      session.status,
      session.paymentIntentId ?? null,
      dataJson,
      now,
      now
    );
  return session;
}

export async function updateAdhocSession(session) {
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(session);
  if (isPostgres()) {
    // No-op skip: identical webhook/poll retries must not rewrite adhoc rows (WAL/bloat).
    await pgPool.query(
      `UPDATE adhoc_sessions
       SET status = $1,
           payment_intent_id = COALESCE($2, payment_intent_id),
           data_json = $3::jsonb,
           updated_at = $4
       WHERE id = $5 AND access_token = $6
         AND (
           adhoc_sessions.data_json IS DISTINCT FROM $3::jsonb
           OR adhoc_sessions.status IS DISTINCT FROM $1
           OR adhoc_sessions.payment_intent_id IS DISTINCT FROM COALESCE($2, adhoc_sessions.payment_intent_id)
         )`,
      [session.status, session.paymentIntentId ?? null, dataJson, now, session.id, session.accessToken]
    );
    return session;
  }
  sqliteDb
    .prepare(
      `UPDATE adhoc_sessions
       SET status = ?, payment_intent_id = COALESCE(?, payment_intent_id), data_json = ?, updated_at = ?
       WHERE id = ? AND access_token = ?`
    )
    .run(
      session.status,
      session.paymentIntentId ?? null,
      dataJson,
      now,
      session.id,
      session.accessToken
    );
  return session;
}

export async function findAdhocSession(id, accessToken) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      'SELECT data_json FROM adhoc_sessions WHERE id = $1 AND access_token = $2',
      [id, accessToken]
    );
    return rows[0] ? parseJson(rows[0].data_json) : null;
  }
  const row = sqliteDb
    .prepare('SELECT data_json FROM adhoc_sessions WHERE id = ? AND access_token = ?')
    .get(id, accessToken);
  return row ? parseJson(row.data_json) : null;
}

/**
 * Normalize a session row / data_json blob into a PV/load target.
 * Pure helper — used by listActiveChargingTargets and unit tests.
 * @param {unknown} raw
 * @param {{ kind?: 'charging'|'adhoc', stationIdFallback?: string|null, connectorIdFallback?: string|number|null }} [meta]
 * @returns {{ sessionId: string|null, kind: 'charging'|'adhoc', stationId: string, connectorId: string|null, evseId: number, powerKw: number, status: string }|null}
 */
export function normalizeChargingTarget(raw, meta = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = /** @type {Record<string, unknown>} */ (raw);
  const stationId = String(
    data.stationId ??
      data.station_id ??
      data.citrineosStationId ??
      meta.stationIdFallback ??
      ''
  ).trim();
  if (!stationId) return null;

  const status = String(data.status ?? 'active').toLowerCase();
  const connectorRaw =
    data.connectorId ?? data.connector_id ?? meta.connectorIdFallback ?? null;
  const connectorId =
    connectorRaw == null || connectorRaw === ''
      ? null
      : String(connectorRaw);

  const evseCandidate = Number(
    data.evseId ?? data.evse_id ?? data.evseNumber ?? data.evse_number ?? 1
  );
  const evseId = Number.isFinite(evseCandidate) && evseCandidate > 0 ? evseCandidate : 1;

  const powerCandidate = Number(data.powerKw ?? data.power_kw ?? data.maxPowerKw ?? 0);
  const powerKw = Number.isFinite(powerCandidate) && powerCandidate > 0 ? powerCandidate : 11;

  const sessionId =
    data.id != null && String(data.id).trim() !== ''
      ? String(data.id)
      : null;

  return {
    sessionId,
    kind: meta.kind === 'adhoc' ? 'adhoc' : 'charging',
    stationId,
    connectorId,
    evseId,
    powerKw,
    status,
  };
}

/**
 * Active account + adhoc sessions as charging targets (for PV surplus / load paths).
 * Dedupes by stationId (first wins: charging before adhoc).
 * @returns {Promise<Array<NonNullable<ReturnType<typeof normalizeChargingTarget>>>>}
 */
export async function listActiveChargingTargets() {
  /** @type {Array<NonNullable<ReturnType<typeof normalizeChargingTarget>>>} */
  const out = [];
  const seenStations = new Set();

  const push = (raw, meta) => {
    const target = normalizeChargingTarget(raw, meta);
    if (!target) return;
    if (seenStations.has(target.stationId)) return;
    seenStations.add(target.stationId);
    out.push(target);
  };

  if (isPostgres()) {
    const { rows: chargeRows } = await pgPool.query(
      `SELECT id, data_json, status
       FROM charging_sessions
       WHERE status IN ('active', 'pending')
       ORDER BY updated_at DESC`
    );
    for (const row of chargeRows) {
      const data = parseJson(row.data_json) ?? {};
      if (data && typeof data === 'object' && !Array.isArray(data) && data.id == null) {
        data.id = row.id;
      }
      if (data && typeof data === 'object' && !Array.isArray(data) && data.status == null) {
        data.status = row.status;
      }
      push(data, { kind: 'charging' });
    }

    const { rows: adhocRows } = await pgPool.query(
      `SELECT id, station_id, connector_id, data_json, status
       FROM adhoc_sessions
       WHERE status IN ('active', 'pending', 'charging')
       ORDER BY updated_at DESC`
    );
    for (const row of adhocRows) {
      const data = parseJson(row.data_json) ?? {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.id == null) data.id = row.id;
        if (data.status == null) data.status = row.status;
      }
      push(data, {
        kind: 'adhoc',
        stationIdFallback: row.station_id,
        connectorIdFallback: row.connector_id,
      });
    }
    return out;
  }

  const chargeRows = sqliteDb
    .prepare(
      `SELECT id, data_json, status
       FROM charging_sessions
       WHERE status IN ('active', 'pending')
       ORDER BY updated_at DESC`
    )
    .all();
  for (const row of chargeRows) {
    const data = parseJson(row.data_json) ?? {};
    if (data && typeof data === 'object' && !Array.isArray(data) && data.id == null) {
      data.id = row.id;
    }
    if (data && typeof data === 'object' && !Array.isArray(data) && data.status == null) {
      data.status = row.status;
    }
    push(data, { kind: 'charging' });
  }

  const adhocRows = sqliteDb
    .prepare(
      `SELECT id, station_id, connector_id, data_json, status
       FROM adhoc_sessions
       WHERE status IN ('active', 'pending', 'charging')
       ORDER BY updated_at DESC`
    )
    .all();
  for (const row of adhocRows) {
    const data = parseJson(row.data_json) ?? {};
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.id == null) data.id = row.id;
      if (data.status == null) data.status = row.status;
    }
    push(data, {
      kind: 'adhoc',
      stationIdFallback: row.station_id,
      connectorIdFallback: row.connector_id,
    });
  }
  return out;
}

export async function getLeaderboardData(limit = 20) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      `SELECT id, email, profile_json
       FROM users
       ORDER BY (profile_json->>'loyaltyPoints')::int DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return rows.map((row) => {
      const profile = parseJson(row.profile_json) ?? {};
      const points = profile.loyaltyPoints ?? 0;
      const tier = computeTier(points);
      const firstName = profile.firstName ?? 'Nutzer';
      const lastName = profile.lastName ?? '';
      return {
        userId: row.id,
        displayName: `${firstName} ${lastName.charAt(0) || ''}.`.trim(),
        points,
        tier: tierLabels[tier] ?? 'Bronze',
      };
    });
  }

  const rows = sqliteDb
    .prepare(
      `SELECT id, email, profile_json
       FROM users
       ORDER BY json_extract(profile_json, '$.loyaltyPoints') DESC
       LIMIT ?`
    )
    .all(limit);

  return rows.map((row) => {
    const profile = parseJson(row.profile_json) ?? {};
    const points = profile.loyaltyPoints ?? 0;
    const tier = computeTier(points);
    const firstName = profile.firstName ?? 'Nutzer';
    const lastName = profile.lastName ?? '';
    return {
      userId: row.id,
      displayName: `${firstName} ${lastName.charAt(0) || ''}.`.trim(),
      points,
      tier: tierLabels[tier] ?? 'Bronze',
    };
  });
}

function rowToFulfillment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    rewardId: row.reward_id,
    type: row.type,
    status: row.status,
    payload: parseJson(row.payload_json) ?? {},
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at ?? null,
    usedAt: row.used_at ?? null,
    sessionId: row.session_id ?? null,
  };
}

export async function insertFulfillment(fulfillment) {
  const payloadJson = JSON.stringify(fulfillment.payload ?? {});
  if (isPostgres()) {
    await pgPool.query(
      `INSERT INTO reward_fulfillments
        (id, user_id, reward_id, type, status, payload_json, redeemed_at, expires_at, used_at, session_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)`,
      [
        fulfillment.id,
        fulfillment.userId,
        fulfillment.rewardId,
        fulfillment.type,
        fulfillment.status ?? 'active',
        payloadJson,
        fulfillment.redeemedAt,
        fulfillment.expiresAt ?? null,
        fulfillment.usedAt ?? null,
        fulfillment.sessionId ?? null,
      ]
    );
    return fulfillment;
  }
  sqliteDb
    .prepare(
      `INSERT INTO reward_fulfillments
        (id, user_id, reward_id, type, status, payload_json, redeemed_at, expires_at, used_at, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      fulfillment.id,
      fulfillment.userId,
      fulfillment.rewardId,
      fulfillment.type,
      fulfillment.status ?? 'active',
      payloadJson,
      fulfillment.redeemedAt,
      fulfillment.expiresAt ?? null,
      fulfillment.usedAt ?? null,
      fulfillment.sessionId ?? null
    );
  return fulfillment;
}

export async function listFulfillments(userId, { status } = {}) {
  if (isPostgres()) {
    const query = status
      ? `SELECT * FROM reward_fulfillments WHERE user_id = $1 AND status = $2 ORDER BY redeemed_at DESC`
      : `SELECT * FROM reward_fulfillments WHERE user_id = $1 ORDER BY redeemed_at DESC`;
    const params = status ? [userId, status] : [userId];
    const { rows } = await pgPool.query(query, params);
    return rows.map(rowToFulfillment);
  }
  const query = status
    ? `SELECT * FROM reward_fulfillments WHERE user_id = ? AND status = ? ORDER BY redeemed_at DESC`
    : `SELECT * FROM reward_fulfillments WHERE user_id = ? ORDER BY redeemed_at DESC`;
  const stmt = sqliteDb.prepare(query);
  const rows = status ? stmt.all(userId, status) : stmt.all(userId);
  return rows.map(rowToFulfillment);
}

export async function getFulfillmentById(userId, fulfillmentId) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      `SELECT * FROM reward_fulfillments WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, fulfillmentId]
    );
    return rows[0] ? rowToFulfillment(rows[0]) : null;
  }
  const row = sqliteDb
    .prepare(`SELECT * FROM reward_fulfillments WHERE user_id = ? AND id = ? LIMIT 1`)
    .get(userId, fulfillmentId);
  return row ? rowToFulfillment(row) : null;
}

export async function markFulfillmentUsed(userId, fulfillmentId, sessionId) {
  const usedAt = new Date().toISOString();
  if (isPostgres()) {
    await pgPool.query(
      `UPDATE reward_fulfillments
       SET status = 'used', used_at = $3, session_id = $4
       WHERE user_id = $1 AND id = $2`,
      [userId, fulfillmentId, usedAt, sessionId ?? null]
    );
    return getFulfillmentById(userId, fulfillmentId);
  }
  sqliteDb
    .prepare(
      `UPDATE reward_fulfillments SET status = 'used', used_at = ?, session_id = ? WHERE user_id = ? AND id = ?`
    )
    .run(usedAt, sessionId ?? null, userId, fulfillmentId);
  return getFulfillmentById(userId, fulfillmentId);
}

export async function listUserMembershipIds() {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      `SELECT id, profile_json->>'membershipId' AS membership_id
       FROM users
       WHERE profile_json->>'membershipId' IS NOT NULL`
    );
    return rows
      .map((row) => ({ userId: row.id, membershipId: row.membership_id }))
      .filter((row) => row.membershipId);
  }
  const rows = sqliteDb.prepare('SELECT id, profile_json FROM users').all();
  return rows
    .map((row) => {
      const profile = parseJson(row.profile_json);
      return { userId: row.id, membershipId: profile?.membershipId };
    })
    .filter((row) => row.membershipId);
}

function formatInvoiceNumber(year, seq) {
  return `BC-${year}-${String(seq).padStart(6, '0')}`;
}

export async function findInvoiceNumberBySessionId(sessionId) {
  if (isPostgres()) {
    const { rows } = await pgPool.query(
      `SELECT invoice_number FROM invoice_registry WHERE session_id = $1 LIMIT 1`,
      [sessionId]
    );
    return rows[0]?.invoice_number ?? null;
  }
  const row = sqliteDb
    .prepare(`SELECT invoice_number FROM invoice_registry WHERE session_id = ? LIMIT 1`)
    .get(sessionId);
  return row?.invoice_number ?? null;
}

/** Fortlaufende, einmalige Rechnungsnummer (§14 UStG) – idempotent pro sessionId. */
export async function allocateInvoiceNumber(userId, sessionId) {
  const existing = await findInvoiceNumberBySessionId(sessionId);
  if (existing) return existing;

  const year = new Date().getFullYear();
  const issuedAt = new Date().toISOString();

  if (isPostgres()) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const again = await client.query(
        `SELECT invoice_number FROM invoice_registry WHERE session_id = $1 LIMIT 1`,
        [sessionId]
      );
      if (again.rows[0]?.invoice_number) {
        await client.query('COMMIT');
        return again.rows[0].invoice_number;
      }

      const counter = await client.query(
        `INSERT INTO invoice_counters (year, last_number)
         VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE
         SET last_number = invoice_counters.last_number + 1
         RETURNING last_number`,
        [year]
      );
      const seq = counter.rows[0].last_number;
      const invoiceNumber = formatInvoiceNumber(year, seq);

      await client.query(
        `INSERT INTO invoice_registry (invoice_number, session_id, user_id, issued_at)
         VALUES ($1, $2, $3, $4)`,
        [invoiceNumber, sessionId, userId, issuedAt]
      );
      await client.query('COMMIT');
      return invoiceNumber;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const allocate = sqliteDb.transaction(() => {
    const row = sqliteDb
      .prepare(`SELECT invoice_number FROM invoice_registry WHERE session_id = ? LIMIT 1`)
      .get(sessionId);
    if (row?.invoice_number) return row.invoice_number;

    const existing = sqliteDb.prepare(`SELECT last_number FROM invoice_counters WHERE year = ?`).get(year);
    let seq;
    if (existing) {
      seq = existing.last_number + 1;
      sqliteDb.prepare(`UPDATE invoice_counters SET last_number = ? WHERE year = ?`).run(seq, year);
    } else {
      seq = 1;
      sqliteDb.prepare(`INSERT INTO invoice_counters (year, last_number) VALUES (?, 1)`).run(year);
    }

    const invoiceNumber = formatInvoiceNumber(year, seq);
    sqliteDb
      .prepare(
        `INSERT INTO invoice_registry (invoice_number, session_id, user_id, issued_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(invoiceNumber, sessionId, userId, issuedAt);
    return invoiceNumber;
  });
  return allocate();
}

/**
 * CitrineOS webhook helpers — sessions live in data_json (not flat columns).
 * Updates both charging_sessions and adhoc_sessions.
 */

function mergeSessionData(data, patch) {
  const next = { ...data, ...patch };
  if (patch.energyKwh !== undefined) next.energyKwh = Number(patch.energyKwh);
  if (patch.costEur !== undefined) next.costEur = Number(patch.costEur);
  return next;
}

/** Cap durable OCPP pricing event log per session (idle/billing consumers). */
const MAX_SESSION_PRICING_EVENTS = 200;

/**
 * Append a charging_state / session_stop event for idle-fee derivation.
 * Dedupes identical consecutive chargingState (+ type) so meter ticks without
 * state change do not bloat data_json. Keeps chronological order, trims head.
 *
 * @param {Record<string, unknown>} data current session document
 * @param {{ type: string, chargingState?: string|null, at?: string|null }} ev
 * @returns {Array<Record<string, unknown>>|undefined} next pricingEvents or undefined if unchanged
 */
export function appendSessionPricingEvent(data, ev) {
  if (!ev || typeof ev !== 'object') return undefined;
  const type = typeof ev.type === 'string' ? ev.type.trim() : '';
  if (!type) return undefined;

  const at =
    typeof ev.at === 'string' && ev.at.trim()
      ? ev.at.trim()
      : new Date().toISOString();
  const chargingState =
    ev.chargingState != null && String(ev.chargingState).trim()
      ? String(ev.chargingState).trim()
      : undefined;

  const prev = Array.isArray(data?.pricingEvents) ? data.pricingEvents : [];
  const last = prev.length ? prev[prev.length - 1] : null;
  if (
    last &&
    last.type === type &&
    (last.chargingState ?? null) === (chargingState ?? null)
  ) {
    // Same state already recorded (e.g. repeated SuspendedEV ticks) — no append.
    return undefined;
  }

  /** @type {Record<string, unknown>} */
  const entry = { at, type };
  if (chargingState) entry.chargingState = chargingState;

  const next = [...prev, entry];
  if (next.length > MAX_SESSION_PRICING_EVENTS) {
    return next.slice(next.length - MAX_SESSION_PRICING_EVENTS);
  }
  return next;
}

/**
 * Import register energy must not go backwards within an active session
 * (stale meter sample / unit glitch / out-of-order deliver without seqNo).
 * Returns the energy to persist, or null when the sample should be ignored.
 * @param {unknown} prevEnergy
 * @param {unknown} nextEnergy
 * @returns {number | null}
 */
export function pickMonotonicEnergyKwh(prevEnergy, nextEnergy) {
  if (nextEnergy == null || nextEnergy === '') return null;
  const next = Number(nextEnergy);
  if (!Number.isFinite(next) || next < 0) return null;
  if (prevEnergy == null || prevEnergy === '') return next;
  const prev = Number(prevEnergy);
  if (!Number.isFinite(prev)) return next;
  // Allow tiny float noise downward; reject real regressions (e.g. Wh/kWh mix-up).
  if (next + 1e-6 < prev) return null;
  return next;
}

async function listActiveSessionRowsByJsonField(field, value) {
  const strVal = String(value);
  const numVal = Number(value);
  const rows = [];

  if (isPostgres()) {
    const { rows: chargeRows } = await pgPool.query(
      `SELECT 'charging' AS kind, id, user_id, data_json, status
       FROM charging_sessions
       WHERE status IN ('active', 'pending')
         AND (
           data_json->>$1 = $2
           OR (
             jsonb_typeof(data_json->$1) = 'number'
             AND (data_json->>$1)::numeric = $3::numeric
           )
         )`,
      [field, strVal, Number.isFinite(numVal) ? numVal : null]
    );
    rows.push(...chargeRows);

    const { rows: adhocRows } = await pgPool.query(
      `SELECT 'adhoc' AS kind, id, access_token, station_id, data_json, status
       FROM adhoc_sessions
       WHERE status IN ('active', 'pending', 'charging')
         AND (
           data_json->>$1 = $2
           OR (
             jsonb_typeof(data_json->$1) = 'number'
             AND (data_json->>$1)::numeric = $3::numeric
           )
         )`,
      [field, strVal, Number.isFinite(numVal) ? numVal : null]
    );
    rows.push(...adhocRows);
    return rows;
  }

  const chargeRows = sqliteDb
    .prepare(
      `SELECT 'charging' AS kind, id, user_id, data_json, status
       FROM charging_sessions
       WHERE status IN ('active', 'pending')
         AND (
           CAST(json_extract(data_json, '$.' || ?) AS TEXT) = ?
           OR CAST(json_extract(data_json, '$.' || ?) AS REAL) = ?
         )`
    )
    .all(field, strVal, field, Number.isFinite(numVal) ? numVal : NaN);
  rows.push(...chargeRows);

  const adhocRows = sqliteDb
    .prepare(
      `SELECT 'adhoc' AS kind, id, access_token, station_id, data_json, status
       FROM adhoc_sessions
       WHERE status IN ('active', 'pending', 'charging')
         AND (
           CAST(json_extract(data_json, '$.' || ?) AS TEXT) = ?
           OR CAST(json_extract(data_json, '$.' || ?) AS REAL) = ?
         )`
    )
    .all(field, strVal, field, Number.isFinite(numVal) ? numVal : NaN);
  rows.push(...adhocRows);
  return rows;
}

async function persistPatchedSessionRow(row, patch) {
  const data = mergeSessionData(parseJson(row.data_json) ?? {}, patch);
  const status = patch.status ?? data.status ?? row.status;
  data.status = status;
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(data);

  if (row.kind === 'charging') {
    if (isPostgres()) {
      // Webhook/metrics hot path: skip no-op rewrites (same pattern as upsertSession).
      // Note: row lock is still taken; benefit is WAL/dead-tuple reduction on identical ticks.
      await pgPool.query(
        `UPDATE charging_sessions
         SET data_json = $1::jsonb, status = $2, updated_at = $3
         WHERE id = $4
           AND (
             charging_sessions.data_json IS DISTINCT FROM $1::jsonb
             OR charging_sessions.status IS DISTINCT FROM $2
           )`,
        [dataJson, status, now, row.id]
      );
    } else {
      sqliteDb
        .prepare(
          `UPDATE charging_sessions
           SET data_json = ?, status = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(dataJson, status, now, row.id);
    }
    return data;
  }

  if (isPostgres()) {
    await pgPool.query(
      `UPDATE adhoc_sessions
       SET data_json = $1::jsonb, status = $2, updated_at = $3
       WHERE id = $4
         AND (
           adhoc_sessions.data_json IS DISTINCT FROM $1::jsonb
           OR adhoc_sessions.status IS DISTINCT FROM $2
         )`,
      [dataJson, status, now, row.id]
    );
  } else {
    sqliteDb
      .prepare(
        `UPDATE adhoc_sessions
         SET data_json = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(dataJson, status, now, row.id);
  }
  return data;
}

/**
 * Apply a normalized CitrineOS transaction webhook event to local session rows.
 * @returns {{ matched: number, actions: string[], matchedRows: object[] }}
 */
export async function applyCitrineosWebhookToSessions(event) {
  const actions = [];
  let matched = 0;
  /** @type {object[]} rows touched this apply — used by LM re-opt station resolution */
  const matchedRows = [];
  /** @type {Set<string>} */
  const matchedRowKeys = new Set();

  const rememberRow = (row) => {
    const key = `${row.kind}:${row.id}`;
    if (matchedRowKeys.has(key)) return;
    matchedRowKeys.add(key);
    matchedRows.push(row);
  };

  const remoteStartId = event.remoteStartId;
  const transactionId = event.transactionId != null ? String(event.transactionId) : null;

  if (remoteStartId != null && transactionId) {
    const rows = await listActiveSessionRowsByJsonField('remoteStartId', remoteStartId);
    for (const row of rows) {
      const data = parseJson(row.data_json) ?? {};
      if (data.citrineosTransactionId && String(data.citrineosTransactionId) === transactionId) {
        continue;
      }
      await persistPatchedSessionRow(row, {
        citrineosTransactionId: transactionId,
        status: data.status === 'pending' ? 'active' : data.status ?? row.status,
      });
      matched += 1;
      rememberRow(row);
      actions.push(`resolve:remoteStartId=${remoteStartId}->tx=${transactionId}`);
    }
  }

  if (
    transactionId &&
    (event.totalKwh != null ||
      event.totalCost != null ||
      event.seqNo != null ||
      event.triggerReason != null ||
      event.chargingState != null)
  ) {
    const rows = await listActiveSessionRowsByJsonField('citrineosTransactionId', transactionId);
    for (const row of rows) {
      const data = parseJson(row.data_json) ?? {};
      const prevSeq =
        data.lastCitrineosEventSeqNo == null ? null : Number(data.lastCitrineosEventSeqNo);
      const nextSeq = event.seqNo == null ? null : Number(event.seqNo);
      // OCPP 2.0.1 offline replay: ignore strictly older TransactionEvent seqNo for metrics.
      if (
        nextSeq != null &&
        Number.isFinite(nextSeq) &&
        prevSeq != null &&
        Number.isFinite(prevSeq) &&
        nextSeq < prevSeq
      ) {
        actions.push(`stale-seq:tx=${transactionId}:seq=${nextSeq}<${prevSeq}`);
        matched += 1;
        rememberRow(row);
        continue;
      }
      const patch = {};
      if (event.totalKwh != null) {
        const energy = pickMonotonicEnergyKwh(data.energyKwh, event.totalKwh);
        if (energy != null) {
          patch.energyKwh = energy;
        } else {
          actions.push(
            `energy-regress:tx=${transactionId}:prev=${data.energyKwh}:next=${event.totalKwh}`
          );
        }
      }
      if (event.totalCost != null) patch.costEur = event.totalCost;
      if (nextSeq != null && Number.isFinite(nextSeq)) patch.lastCitrineosEventSeqNo = nextSeq;
      if (event.eventType != null) patch.lastCitrineosEventType = event.eventType;
      if (event.triggerReason != null) patch.lastCitrineosTriggerReason = event.triggerReason;
      // OCPP chargingState for LM/UI (SuspendedEVSE vs Charging) — dual keys for consumers.
      // Also append durable pricingEvents so idle-fee deriveIdleIntervals can run offline.
      if (event.chargingState != null && String(event.chargingState).trim()) {
        const cs = String(event.chargingState).trim();
        patch.chargingState = cs;
        patch.lastCitrineosChargingState = cs;
        const pricingEvents = appendSessionPricingEvent(data, {
          type: 'charging_state',
          chargingState: cs,
        });
        if (pricingEvents) patch.pricingEvents = pricingEvents;
      }
      // Persist station id from webhook so later re-opt / diagnostics have a stable source.
      if (event.stationId != null && String(event.stationId).trim()) {
        patch.citrineosStationId = String(event.stationId).trim();
      }
      // Gap detection: offline buffer / dropped TransactionEvents (seq should be monotonic +1).
      if (
        nextSeq != null &&
        Number.isFinite(nextSeq) &&
        prevSeq != null &&
        Number.isFinite(prevSeq) &&
        nextSeq > prevSeq + 1
      ) {
        patch.lastCitrineosSeqGap = {
          from: prevSeq,
          to: nextSeq,
          missing: nextSeq - prevSeq - 1,
          at: new Date().toISOString(),
        };
        actions.push(`seq-gap:tx=${transactionId}:seq=${prevSeq}->${nextSeq}`);
      }
      if (Object.keys(patch).length === 0) continue;
      await persistPatchedSessionRow(row, patch);
      matched += 1;
      rememberRow(row);
      actions.push(
        event.triggerReason
          ? `metrics:tx=${transactionId}:trigger=${event.triggerReason}`
          : `metrics:tx=${transactionId}`
      );
    }
  }

  if (transactionId && event.isActive === false) {
    const rows = await listActiveSessionRowsByJsonField('citrineosTransactionId', transactionId);
    for (const row of rows) {
      const data = parseJson(row.data_json) ?? {};
      const prevSeq =
        data.lastCitrineosEventSeqNo == null ? null : Number(data.lastCitrineosEventSeqNo);
      const nextSeq = event.seqNo == null ? null : Number(event.seqNo);
      // Still allow Ended if seq is equal/newer/unknown; skip only clearly stale ends.
      if (
        nextSeq != null &&
        Number.isFinite(nextSeq) &&
        prevSeq != null &&
        Number.isFinite(prevSeq) &&
        nextSeq < prevSeq
      ) {
        actions.push(`stale-stop:tx=${transactionId}:seq=${nextSeq}<${prevSeq}`);
        matched += 1;
        rememberRow(row);
        continue;
      }
      const endedAt = new Date().toISOString();
      const patch = {
        status: 'completed',
        endedAt,
        citrineosTxActive: false,
      };
      // Keep final meter/cost on the stop patch so Ended is self-contained even if
      // the metrics branch skipped (e.g. only isActive=false + energy in one event).
      // Still reject clear energy regressions (unit glitch) so final kWh is not understated.
      if (event.totalKwh != null) {
        const energy = pickMonotonicEnergyKwh(data.energyKwh, event.totalKwh);
        if (energy != null) {
          patch.energyKwh = energy;
        } else {
          actions.push(
            `energy-regress-stop:tx=${transactionId}:prev=${data.energyKwh}:next=${event.totalKwh}`
          );
        }
      }
      if (event.totalCost != null) patch.costEur = event.totalCost;
      if (nextSeq != null && Number.isFinite(nextSeq)) patch.lastCitrineosEventSeqNo = nextSeq;
      if (event.eventType != null) patch.lastCitrineosEventType = event.eventType;
      if (event.triggerReason != null) patch.lastCitrineosTriggerReason = event.triggerReason;
      if (event.chargingState != null && String(event.chargingState).trim()) {
        const cs = String(event.chargingState).trim();
        patch.chargingState = cs;
        patch.lastCitrineosChargingState = cs;
        // Seed charging_state before session_stop so open idle intervals close cleanly.
        const withState = appendSessionPricingEvent(data, {
          type: 'charging_state',
          chargingState: cs,
          at: endedAt,
        });
        if (withState) {
          patch.pricingEvents = withState;
        }
      }
      {
        const baseForStop = {
          ...data,
          ...(patch.pricingEvents ? { pricingEvents: patch.pricingEvents } : {}),
        };
        const withStop = appendSessionPricingEvent(baseForStop, {
          type: 'session_stop',
          at: endedAt,
        });
        if (withStop) patch.pricingEvents = withStop;
      }
      if (event.stationId != null && String(event.stationId).trim()) {
        patch.citrineosStationId = String(event.stationId).trim();
      }
      if (
        nextSeq != null &&
        Number.isFinite(nextSeq) &&
        prevSeq != null &&
        Number.isFinite(prevSeq) &&
        nextSeq > prevSeq + 1
      ) {
        patch.lastCitrineosSeqGap = {
          from: prevSeq,
          to: nextSeq,
          missing: nextSeq - prevSeq - 1,
          at: endedAt,
        };
        actions.push(`seq-gap:tx=${transactionId}:seq=${prevSeq}->${nextSeq}`);
      }
      await persistPatchedSessionRow(row, patch);
      matched += 1;
      rememberRow(row);
      actions.push(`stop:tx=${transactionId}`);
    }
  }

  return { matched, actions, matchedRows };
}
