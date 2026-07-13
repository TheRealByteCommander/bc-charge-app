import { randomUUID } from 'crypto';
import { getDbHandles } from '../db.mjs';
import { buildTariffVersionPayload, citrineosTariffToComponents } from './tariffModel.mjs';
import { createTariffSnapshot } from './tariffSnapshot.mjs';

const TENANT = process.env.BC_TENANT_ID ?? 'default';

function db() {
  return getDbHandles();
}

export async function initPricingTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS pricing_tariffs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      citrineos_tariff_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pricing_tariffs_tenant ON pricing_tariffs(tenant_id);

    CREATE TABLE IF NOT EXISTS pricing_tariff_versions (
      id TEXT PRIMARY KEY,
      tariff_id TEXT NOT NULL REFERENCES pricing_tariffs(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT,
      timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
      currency TEXT NOT NULL DEFAULT 'EUR',
      tax_rate_bp INTEGER NOT NULL DEFAULT 1900,
      components_json TEXT NOT NULL,
      min_price TEXT,
      max_price TEXT,
      combination_rule TEXT NOT NULL DEFAULT 'sum_components',
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      UNIQUE(tariff_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_pricing_versions_tariff ON pricing_tariff_versions(tariff_id);
    CREATE INDEX IF NOT EXISTS idx_pricing_versions_status ON pricing_tariff_versions(status);

    CREATE TABLE IF NOT EXISTS pricing_tariff_audit (
      id TEXT PRIMARY KEY,
      tariff_id TEXT NOT NULL,
      version_id TEXT,
      action TEXT NOT NULL,
      actor TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pricing_audit_tariff ON pricing_tariff_audit(tariff_id);

    CREATE TABLE IF NOT EXISTS pricing_snapshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tariff_version_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      source TEXT NOT NULL,
      mid_certified INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      meter_proofs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_snapshots_session ON pricing_snapshots(session_id);

    CREATE TABLE IF NOT EXISTS pricing_ledger (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      snapshot_id TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      net_eur TEXT NOT NULL,
      tax_eur TEXT NOT NULL,
      gross_eur TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      reason TEXT NOT NULL,
      reverses_entry_id TEXT,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pricing_ledger_session ON pricing_ledger(session_id);
  `;

  if (db().isPostgres) {
    await db().pgPool.query(sql);
  } else {
    db().sqliteDb.exec(sql);
  }
}

function parseJson(val) {
  return typeof val === 'string' ? JSON.parse(val) : val;
}

function rowToVersion(row) {
  return {
    id: row.id,
    tariffId: row.tariff_id,
    version: row.version,
    status: row.status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    timezone: row.timezone,
    currency: row.currency,
    taxRateBp: row.tax_rate_bp,
    components: parseJson(row.components_json),
    minPrice: row.min_price,
    maxPrice: row.max_price,
    combinationRule: row.combination_rule,
    hash: row.hash,
    name: row.tariff_name ?? row.name,
    citrineosTariffId: row.citrineos_tariff_id,
    activatedAt: row.activated_at,
  };
}

export async function listTariffs(tenantId = TENANT) {
  const q = `SELECT * FROM pricing_tariffs WHERE tenant_id = $1 ORDER BY name`;
  if (db().isPostgres) {
    const { rows } = await db().pgPool.query(q.replace(/\$\d/g, () => '$1'), [tenantId]);
    return rows;
  }
  return db().sqliteDb.prepare(q.replace(/\$1/g, '?')).all(tenantId);
}

export async function listTariffVersions(tariffId) {
  const sql = `
    SELECT v.*, t.name AS tariff_name, t.citrineos_tariff_id
    FROM pricing_tariff_versions v
    JOIN pricing_tariffs t ON t.id = v.tariff_id
    WHERE v.tariff_id = ?
    ORDER BY v.version DESC
  `;
  if (db().isPostgres) {
    const { rows } = await db().pgPool.query(sql.replace(/\?/g, '$1'), [tariffId]);
    return rows.map(rowToVersion);
  }
  return db().sqliteDb.prepare(sql).all(tariffId).map(rowToVersion);
}

export async function getActiveTariffVersion(tariffId, at = new Date().toISOString()) {
  const sql = `
    SELECT v.*, t.name AS tariff_name, t.citrineos_tariff_id
    FROM pricing_tariff_versions v
    JOIN pricing_tariffs t ON t.id = v.tariff_id
    WHERE v.tariff_id = ? AND v.status = 'active'
      AND v.valid_from <= ? AND (v.valid_to IS NULL OR v.valid_to > ?)
    ORDER BY v.version DESC LIMIT 1
  `;
  const row = db().isPostgres
    ? (await db().pgPool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), [tariffId, at, at])).rows[0]
    : db().sqliteDb.prepare(sql).get(tariffId, at, at);
  return row ? rowToVersion(row) : null;
}

export async function createTariffFromCitrineos({ name, citrineosTariff }) {
  const now = new Date().toISOString();
  const tariffId = `tar_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const components = citrineosTariffToComponents(citrineosTariff);
  const versionBody = buildTariffVersionPayload({
    tariffId,
    version: 1,
    name,
    validFrom: now,
    currency: citrineosTariff?.currency ?? 'EUR',
    taxRateBp: Math.round((citrineosTariff?.taxRate ?? 0.19) * 10_000),
    components,
    citrineosTariffId: citrineosTariff?.id != null ? String(citrineosTariff.id) : null,
    status: 'draft',
  });

  const versionId = `tv_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  if (db().isPostgres) {
    await db().pgPool.query(
      `INSERT INTO pricing_tariffs (id, tenant_id, name, citrineos_tariff_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5)`,
      [tariffId, TENANT, name, versionBody.citrineosTariffId, now]
    );
    await insertVersionPg(versionId, tariffId, versionBody, now);
  } else {
    db().sqliteDb
      .prepare(
        `INSERT INTO pricing_tariffs (id, tenant_id, name, citrineos_tariff_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?)`
      )
      .run(tariffId, TENANT, name, versionBody.citrineosTariffId, now, now);
    insertVersionSqlite(versionId, tariffId, versionBody, now);
  }

  await appendAudit(tariffId, versionId, 'import_citrineos', null, { citrineosTariff });
  return { tariffId, versionId, version: { ...versionBody, id: versionId } };
}

async function insertVersionPg(versionId, tariffId, body, now) {
  await db().pgPool.query(
    `INSERT INTO pricing_tariff_versions
     (id, tariff_id, version, status, valid_from, valid_to, timezone, currency, tax_rate_bp,
      components_json, min_price, max_price, combination_rule, hash, created_at, activated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      versionId,
      tariffId,
      body.version,
      body.status,
      body.validFrom,
      body.validTo,
      body.timezone,
      body.currency,
      body.taxRateBp,
      JSON.stringify(body.components),
      body.minPrice,
      body.maxPrice,
      body.combinationRule,
      body.hash,
      now,
      null,
    ]
  );
}

function insertVersionSqlite(versionId, tariffId, body, now) {
  db().sqliteDb
    .prepare(
      `INSERT INTO pricing_tariff_versions
       (id, tariff_id, version, status, valid_from, valid_to, timezone, currency, tax_rate_bp,
        components_json, min_price, max_price, combination_rule, hash, created_at, activated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      versionId,
      tariffId,
      body.version,
      body.status,
      body.validFrom,
      body.validTo,
      body.timezone,
      body.currency,
      body.taxRateBp,
      JSON.stringify(body.components),
      body.minPrice,
      body.maxPrice,
      body.combinationRule,
      body.hash,
      now,
      null
    );
}

export async function activateTariffVersion(tariffId, versionId, actor = null) {
  const now = new Date().toISOString();
  const archiveSql = `UPDATE pricing_tariff_versions SET status = 'archived' WHERE tariff_id = ? AND status = 'active'`;
  const activateSql = `UPDATE pricing_tariff_versions SET status = 'active', activated_at = ? WHERE id = ? AND tariff_id = ?`;

  if (db().isPostgres) {
    await db().pgPool.query(archiveSql.replace(/\?/g, '$1'), [tariffId]);
    await db().pgPool.query(activateSql.replace(/\?/g, (_, i) => `$${i + 1}`), [now, versionId, tariffId]);
  } else {
    db().sqliteDb.prepare(archiveSql).run(tariffId);
    db().sqliteDb.prepare(activateSql).run(now, versionId, tariffId);
  }
  await appendAudit(tariffId, versionId, 'activate', actor, {});
}

export async function rollbackTariffVersion(tariffId, targetVersionId, actor = null) {
  await activateTariffVersion(tariffId, targetVersionId, actor);
  await appendAudit(tariffId, targetVersionId, 'rollback', actor, {});
}

export async function appendAudit(tariffId, versionId, action, actor, payload) {
  const id = `aud_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  const json = JSON.stringify(payload ?? {});
  if (db().isPostgres) {
    await db().pgPool.query(
      `INSERT INTO pricing_tariff_audit (id, tariff_id, version_id, action, actor, payload_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, tariffId, versionId, action, actor, json, now]
    );
  } else {
    db().sqliteDb
      .prepare(
        `INSERT INTO pricing_tariff_audit (id, tariff_id, version_id, action, actor, payload_json, created_at)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(id, tariffId, versionId, action, actor, json, now);
  }
}

export async function listTariffAudit(tariffId, limit = 50) {
  const sql = `SELECT * FROM pricing_tariff_audit WHERE tariff_id = ? ORDER BY created_at DESC LIMIT ?`;
  if (db().isPostgres) {
    const { rows } = await db().pgPool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), [tariffId, limit]);
    return rows.map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
  }
  return db().sqliteDb
    .prepare(sql)
    .all(tariffId, limit)
    .map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
}

export async function saveSnapshot(snapshot) {
  const now = snapshot.frozenAt ?? new Date().toISOString();
  const payload = JSON.stringify(snapshot);
  const proofs = JSON.stringify(snapshot.meterProofs ?? []);
  if (db().isPostgres) {
    await db().pgPool.query(
      `INSERT INTO pricing_snapshots
       (id, session_id, tariff_version_id, hash, source, mid_certified, payload_json, meter_proofs_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (session_id) DO NOTHING`,
      [
        snapshot.id,
        snapshot.sessionId,
        snapshot.tariffVersionId,
        snapshot.hash,
        snapshot.source,
        snapshot.midCertified ? 1 : 0,
        payload,
        proofs,
        now,
      ]
    );
  } else {
    db().sqliteDb
      .prepare(
        `INSERT OR IGNORE INTO pricing_snapshots
         (id, session_id, tariff_version_id, hash, source, mid_certified, payload_json, meter_proofs_json, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(
        snapshot.id,
        snapshot.sessionId,
        snapshot.tariffVersionId,
        snapshot.hash,
        snapshot.source,
        snapshot.midCertified ? 1 : 0,
        payload,
        proofs,
        now
      );
  }
}

export async function getSnapshotBySession(sessionId) {
  const sql = `SELECT payload_json FROM pricing_snapshots WHERE session_id = ?`;
  const row = db().isPostgres
    ? (await db().pgPool.query(sql.replace('?', '$1'), [sessionId])).rows[0]
    : db().sqliteDb.prepare(sql).get(sessionId);
  return row ? parseJson(row.payload_json) : null;
}

export async function appendLedgerEntries(sessionId, snapshotId, entries) {
  const now = new Date().toISOString();
  let pos = 0;
  for (const e of entries) {
    const id = `led_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    pos += 1;
    if (db().isPostgres) {
      await db().pgPool.query(
        `INSERT INTO pricing_ledger
         (id, session_id, snapshot_id, entry_type, position, net_eur, tax_eur, gross_eur, currency, reason, reverses_entry_id, meta_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'EUR',$9,$10,$11,$12)`,
        [
          id,
          sessionId,
          snapshotId,
          e.entryType,
          pos,
          e.netEur,
          e.taxEur,
          e.grossEur,
          e.reason,
          e.reversesEntryId ?? null,
          JSON.stringify(e.meta ?? {}),
          now,
        ]
      );
    } else {
      db().sqliteDb
        .prepare(
          `INSERT INTO pricing_ledger
           (id, session_id, snapshot_id, entry_type, position, net_eur, tax_eur, gross_eur, currency, reason, reverses_entry_id, meta_json, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          id,
          sessionId,
          snapshotId,
          e.entryType,
          pos,
          e.netEur,
          e.taxEur,
          e.grossEur,
          'EUR',
          e.reason,
          e.reversesEntryId ?? null,
          JSON.stringify(e.meta ?? {}),
          now
        );
    }
  }
}

export { createTariffSnapshot };
