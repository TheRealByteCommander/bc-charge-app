import { sqliteDb, pgPool, isPostgres } from '../db.mjs';

const DEFAULT_LOYALTY_CONFIG = {
  pointsPerKwh: 1.2,
  pointsPerSession: 10,
  tierThresholds: {
    bronze: { min: 0, multiplier: 1 },
    silver: { min: 1500, multiplier: 1.15 },
    gold: { min: 4000, multiplier: 1.3 },
    platinum: { min: 8000, multiplier: 1.5 },
  },
  challenges: [
    {
      id: 'ch_sessions_3',
      titleDe: 'Dreifach-Lader',
      titleEn: 'Triple charger',
      descDe: '3 Ladesitzungen diese Woche',
      descEn: '3 charging sessions this week',
      target: 3,
      rewardPoints: 200,
      metric: 'sessions_week',
    },
    {
      id: 'ch_points_500',
      titleDe: 'Points-Sprinter',
      titleEn: 'Points sprinter',
      descDe: '500 BC Points diese Woche sammeln',
      descEn: 'Earn 500 BC Points this week',
      target: 500,
      rewardPoints: 150,
      metric: 'points_week',
    },
    {
      id: 'ch_stations_2',
      titleDe: 'Netz-Entdecker',
      titleEn: 'Network explorer',
      descDe: '2 verschiedene Stationen diese Woche',
      descEn: '2 different stations this week',
      target: 2,
      rewardPoints: 175,
      metric: 'stations_week',
    },
    {
      id: 'ch_streak_5',
      titleDe: 'Streak-Meister',
      titleEn: 'Streak master',
      descDe: '5 Tage Ladestreak',
      descEn: '5-day charging streak',
      target: 5,
      rewardPoints: 300,
      metric: 'streak_days',
    },
  ],
};

export async function getLoyaltyConfig() {
  if (isPostgres()) {
    const { rows } = await pgPool.query('SELECT value_json FROM app_config WHERE key = $1', ['loyalty']);
    if (rows.length === 0) return DEFAULT_LOYALTY_CONFIG;
    return rows[0].value_json;
  }

  const row = sqliteDb.prepare('SELECT value_json FROM app_config WHERE key = ?').get('loyalty');
  if (!row) return DEFAULT_LOYALTY_CONFIG;
  // SQLite stores TEXT; corrupt rows must not crash admin/loyalty reads.
  try {
    const parsed = typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json;
    return parsed && typeof parsed === 'object' ? parsed : DEFAULT_LOYALTY_CONFIG;
  } catch {
    return DEFAULT_LOYALTY_CONFIG;
  }
}

export async function setLoyaltyConfig(config) {
  const valueJson = JSON.stringify(config);
  if (isPostgres()) {
    // Skip no-op rewrites (IS DISTINCT FROM) — rare admin path, but avoids WAL on repeated saves.
    await pgPool.query(
      `INSERT INTO app_config (key, value_json, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value_json = EXCLUDED.value_json,
           updated_at = EXCLUDED.updated_at
       WHERE app_config.value_json IS DISTINCT FROM EXCLUDED.value_json`,
      ['loyalty', valueJson]
    );
  } else {
    const now = new Date().toISOString();
    sqliteDb.prepare(
      'INSERT INTO app_config (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at'
    ).run('loyalty', valueJson, now);
  }
}

export async function initConfigTable() {
  if (isPostgres()) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
}
