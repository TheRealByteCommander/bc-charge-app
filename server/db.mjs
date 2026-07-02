import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.BC_DB_PATH ?? resolve(root, 'data', 'bc-charge.sqlite');
const dbClient = (process.env.BC_DB_CLIENT ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();

let sqliteDb;
let pgPool;

function isPostgres() {
  return dbClient === 'postgres';
}

function parseJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
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

      CREATE TABLE IF NOT EXISTS redeemed_rewards (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_id TEXT NOT NULL,
        redeemed_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, reward_id)
      );

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
    `);
    return pgPool;
  }

  if (sqliteDb) return sqliteDb;
  mkdirSync(dirname(dbPath), { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

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

    CREATE TABLE IF NOT EXISTS redeemed_rewards (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, reward_id)
    );

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
  `);
  return sqliteDb;
}

export function rowToProfile(row) {
  const profile = parseJson(row.profile_json);
  return {
    ...profile,
    id: row.id,
    email: row.email,
    stripeCustomerId: row.stripe_customer_id ?? profile.stripeCustomerId,
    passwordHash: '',
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
  if (isPostgres()) {
    await pgPool.query(
      `UPDATE users
       SET profile_json = $1::jsonb,
           stripe_customer_id = COALESCE($2, stripe_customer_id),
           updated_at = $3
       WHERE id = $4`,
      [JSON.stringify(merged), stripeCustomerId ?? null, now, userId]
    );
    return true;
  }
  sqliteDb
    .prepare(
      `UPDATE users SET profile_json = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), updated_at = ? WHERE id = ?`
    )
    .run(JSON.stringify(merged), stripeCustomerId ?? null, now, userId);
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
    return rows.map((r) => parseJson(r.data_json));
  }
  const rows = sqliteDb
    .prepare('SELECT data_json FROM charging_sessions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  return rows.map((r) => JSON.parse(r.data_json));
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
  return row ? JSON.parse(row.data_json) : null;
}

export async function upsertSession(userId, session) {
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(session);
  if (isPostgres()) {
    await pgPool.query(
      `INSERT INTO charging_sessions (id, user_id, data_json, status, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET data_json = EXCLUDED.data_json,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at`,
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
}

export async function replaceSessions(userId, sessions) {
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
    await pgPool.query(
      `UPDATE adhoc_sessions
       SET status = $1,
           payment_intent_id = COALESCE($2, payment_intent_id),
           data_json = $3::jsonb,
           updated_at = $4
       WHERE id = $5 AND access_token = $6`,
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
  return row ? JSON.parse(row.data_json) : null;
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
      const profile = parseJson(row.profile_json);
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
    const profile = JSON.parse(row.profile_json ?? '{}');
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
