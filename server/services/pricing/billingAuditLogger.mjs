/**
 * Billing Audit Logger – unveränderliches Finanz-Audit-Log.
 *
 * Quelle: feature/monetization-logic → billing-audit-logger.ts
 * Persistenz in DB (billing_audit_log), Checksumme HMAC-SHA256 statt XOR/lokaler Pfad.
 */

import { createHmac, randomUUID } from 'crypto';
import { getDbHandles } from '../../db.mjs';

const AUDIT_EVENTS = new Set([
  'SESSION_START',
  'ENERGY_CHARGE',
  'BLOCK_FEE',
  'SESSION_END',
  'PAYMENT_SUCCESS',
  'REFUND',
  'REVENUE_SHARE',
]);

function db() {
  return getDbHandles();
}

function auditSecret() {
  return (
    process.env.BC_BILLING_AUDIT_SECRET ||
    process.env.BC_JWT_SECRET ||
    'bc-charge-dev-audit-only'
  );
}

export function generateChecksum(payloadString) {
  return createHmac('sha256', auditSecret()).update(payloadString).digest('hex');
}

export async function initBillingAuditTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS billing_audit_log (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event TEXT NOT NULL,
      amount_eur TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      meta_json TEXT NOT NULL DEFAULT '{}',
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_billing_audit_session ON billing_audit_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_billing_audit_created ON billing_audit_log(created_at);
  `;
  if (db().isPostgres) {
    await db().pgPool.query(sql);
  } else {
    db().sqliteDb.exec(sql);
  }
}

/**
 * @param {string} sessionId
 * @param {string} event
 * @param {number|string} amount – Netto EUR
 * @param {Record<string, unknown>} [meta]
 */
export async function logBillingEvent(sessionId, event, amount, meta = {}) {
  if (!sessionId) throw new Error('sessionId erforderlich');
  if (!AUDIT_EVENTS.has(event)) {
    throw new Error(`Ungültiges Audit-Event: ${event}`);
  }

  const id = `baud_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const createdAt = new Date().toISOString();
  const amountEur = String(amount);
  const metaJson = JSON.stringify(meta ?? {});

  const entryForHash = JSON.stringify({
    id,
    sessionId,
    event,
    amount: amountEur,
    currency: 'EUR',
    meta: meta ?? {},
    createdAt,
  });
  const checksum = generateChecksum(entryForHash);

  try {
    if (db().isPostgres) {
      await db().pgPool.query(
        `INSERT INTO billing_audit_log
         (id, session_id, event, amount_eur, currency, meta_json, checksum, created_at)
         VALUES ($1,$2,$3,$4,'EUR',$5,$6,$7)`,
        [id, sessionId, event, amountEur, metaJson, checksum, createdAt]
      );
    } else {
      db().sqliteDb
        .prepare(
          `INSERT INTO billing_audit_log
           (id, session_id, event, amount_eur, currency, meta_json, checksum, created_at)
           VALUES (?,?,?,?,?,?,?,?)`
        )
        .run(id, sessionId, event, amountEur, 'EUR', metaJson, checksum, createdAt);
    }
  } catch (error) {
    console.error(`[CRITICAL] Audit Logging failed for session ${sessionId}:`, error);
    throw new Error('Audit failure: Transaction cannot be processed without log.');
  }

  return { id, sessionId, event, amount: amountEur, checksum, createdAt };
}

export async function listBillingAudit(sessionId, limit = 100) {
  const sql = `SELECT * FROM billing_audit_log WHERE session_id = ? ORDER BY created_at ASC LIMIT ?`;
  if (db().isPostgres) {
    const { rows } = await db().pgPool.query(sql.replace(/\?/g, (_, i) => `$${i + 1}`), [
      sessionId,
      limit,
    ]);
    return rows.map(mapRow);
  }
  return db().sqliteDb.prepare(sql).all(sessionId, limit).map(mapRow);
}

function parseMetaJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // Corrupt audit meta must not break list/verify paths
    return null;
  }
}

function mapRow(r) {
  return {
    id: r.id,
    sessionId: r.session_id,
    event: r.event,
    amount: r.amount_eur,
    currency: r.currency,
    meta: parseMetaJson(r.meta_json),
    checksum: r.checksum,
    createdAt: r.created_at,
  };
}

/** Prüft HMAC aller Einträge einer Session. */
export async function verifyIntegrity(sessionId) {
  const entries = await listBillingAudit(sessionId, 10_000);
  for (const e of entries) {
    const entryForHash = JSON.stringify({
      id: e.id,
      sessionId: e.sessionId,
      event: e.event,
      amount: e.amount,
      currency: e.currency,
      meta: e.meta,
      createdAt: e.createdAt,
    });
    if (generateChecksum(entryForHash) !== e.checksum) return false;
  }
  return true;
}

/** Klassen-API (Prototype-Kompatibilität) */
export class BillingAuditLogger {
  logEvent(sessionId, event, amount, meta) {
    return logBillingEvent(sessionId, event, amount, meta);
  }

  verifyIntegrity(sessionId) {
    return verifyIntegrity(sessionId);
  }
}
