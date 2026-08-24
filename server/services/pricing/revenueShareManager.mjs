/**
 * Revenue Share Manager – Aufteilung Brutto/Netto zwischen BC Charge und Standortpartner.
 *
 * Quelle: feature/monetization-logic → revenue-share-manager.ts
 * Cost-Plus: Energie-B2B-Kosten zuerst abziehen, dann Marge splitten.
 * Geldbeträge über money.mjs (Cent-sicher).
 */

import { randomUUID } from 'crypto';
import {
  moneyFromDecimal,
  moneyToDecimal,
  roundMoneyToCents,
} from './money.mjs';
import { getDbHandles } from '../../db.mjs';
import { logBillingEvent } from './billingAuditLogger.mjs';

/**
 * @typedef {object} RevenueShareAgreement
 * @property {string} partnerId
 * @property {string} siteId
 * @property {boolean} energyCostPassThrough
 * @property {number} partnerMarginPercentage – 0..1
 * @property {number} bcChargeMarginPercentage – 0..1
 */

/**
 * @typedef {object} DistributionResult
 * @property {string} grossRevenue
 * @property {string} totalEnergyCost
 * @property {string} shareableMargin
 * @property {string} partnerPayout
 * @property {string} bcChargePayout
 * @property {string} vatAmount
 */

function db() {
  return getDbHandles();
}

export async function initRevenueShareTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS revenue_share_agreements (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      energy_cost_pass_through INTEGER NOT NULL DEFAULT 1,
      partner_margin_pct TEXT NOT NULL,
      bc_charge_margin_pct TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(partner_id, site_id)
    );
    CREATE INDEX IF NOT EXISTS idx_revenue_share_site ON revenue_share_agreements(site_id);

    CREATE TABLE IF NOT EXISTS revenue_share_distributions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agreement_id TEXT,
      site_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_revenue_dist_session ON revenue_share_distributions(session_id);
  `;
  if (db().isPostgres) {
    await db().pgPool.query(sql);
  } else {
    db().sqliteDb.exec(sql);
  }
}

/**
 * @param {object} calculation – SessionCalculation oder { netTotal, grossTotal }
 * @param {RevenueShareAgreement} agreement
 * @param {number|string} actualEnergyCost – B2B-Energiekosten EUR
 * @returns {DistributionResult}
 */
export function calculateSplit(calculation, agreement, actualEnergyCost) {
  const partnerPct = Number(agreement.partnerMarginPercentage);
  const bcPct = Number(agreement.bcChargeMarginPercentage);
  if (!(partnerPct >= 0 && bcPct >= 0) || Math.abs(partnerPct + bcPct - 1) > 0.001) {
    throw new Error('partnerMarginPercentage + bcChargeMarginPercentage müssen 1 ergeben');
  }

  const netRevenue = moneyFromDecimal(calculation.netTotal);
  const grossRevenue = moneyFromDecimal(calculation.grossTotal);
  const energyCostScaled = moneyFromDecimal(actualEnergyCost);

  const shareable =
    agreement.energyCostPassThrough !== false
      ? netRevenue - energyCostScaled
      : netRevenue;

  if (shareable < 0n) {
    console.warn(`[FINANCIAL-ALERT] Session generates a loss of ${moneyToDecimal(shareable)} EUR`);
  }

  // Anteil auf Cent runden; Rest geht an BC Charge (vermeidet Rundungsdrift)
  const partnerRaw = (shareable * BigInt(Math.round(partnerPct * 10_000))) / 10_000n;
  const partnerPayout = roundMoneyToCents(partnerRaw);
  const bcChargePayout = roundMoneyToCents(shareable - partnerPayout);
  const vatAmount = roundMoneyToCents(grossRevenue - netRevenue);

  return {
    grossRevenue: moneyToDecimal(roundMoneyToCents(grossRevenue)),
    totalEnergyCost: moneyToDecimal(roundMoneyToCents(energyCostScaled)),
    shareableMargin: moneyToDecimal(roundMoneyToCents(shareable)),
    partnerPayout: moneyToDecimal(partnerPayout),
    bcChargePayout: moneyToDecimal(bcChargePayout),
    vatAmount: moneyToDecimal(vatAmount),
  };
}

export async function upsertAgreement(agreement) {
  const id = agreement.id ?? `rsa_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  const pass = agreement.energyCostPassThrough !== false ? 1 : 0;
  const partnerPct = String(agreement.partnerMarginPercentage);
  const bcPct = String(agreement.bcChargeMarginPercentage);

  if (db().isPostgres) {
    // Skip no-op rewrites (IS DISTINCT FROM) — admin path, same family as app_config.
    // On no-op UPDATE, RETURNING is empty → resolve existing id so callers keep stable PK.
    const result = await db().pgPool.query(
      `INSERT INTO revenue_share_agreements
       (id, partner_id, site_id, energy_cost_pass_through, partner_margin_pct, bc_charge_margin_pct, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,$7)
       ON CONFLICT (partner_id, site_id) DO UPDATE SET
         energy_cost_pass_through = EXCLUDED.energy_cost_pass_through,
         partner_margin_pct = EXCLUDED.partner_margin_pct,
         bc_charge_margin_pct = EXCLUDED.bc_charge_margin_pct,
         active = 1,
         updated_at = EXCLUDED.updated_at
       WHERE revenue_share_agreements.energy_cost_pass_through IS DISTINCT FROM EXCLUDED.energy_cost_pass_through
          OR revenue_share_agreements.partner_margin_pct IS DISTINCT FROM EXCLUDED.partner_margin_pct
          OR revenue_share_agreements.bc_charge_margin_pct IS DISTINCT FROM EXCLUDED.bc_charge_margin_pct
          OR revenue_share_agreements.active IS DISTINCT FROM 1
       RETURNING id`,
      [id, agreement.partnerId, agreement.siteId, pass, partnerPct, bcPct, now]
    );
    let resolvedId = result.rows[0]?.id;
    if (!resolvedId) {
      const existing = await db().pgPool.query(
        `SELECT id FROM revenue_share_agreements WHERE partner_id = $1 AND site_id = $2`,
        [agreement.partnerId, agreement.siteId]
      );
      resolvedId = existing.rows[0]?.id ?? id;
    }
    return { ...agreement, id: resolvedId };
  }

  // SQLite parity with PG IS DISTINCT FROM: skip identical admin rewrites (local/dev).
  const write = db().sqliteDb
    .prepare(
      `INSERT INTO revenue_share_agreements
       (id, partner_id, site_id, energy_cost_pass_through, partner_margin_pct, bc_charge_margin_pct, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)
       ON CONFLICT(partner_id, site_id) DO UPDATE SET
         energy_cost_pass_through = excluded.energy_cost_pass_through,
         partner_margin_pct = excluded.partner_margin_pct,
         bc_charge_margin_pct = excluded.bc_charge_margin_pct,
         active = 1,
         updated_at = excluded.updated_at
       WHERE revenue_share_agreements.energy_cost_pass_through IS NOT excluded.energy_cost_pass_through
          OR revenue_share_agreements.partner_margin_pct IS NOT excluded.partner_margin_pct
          OR revenue_share_agreements.bc_charge_margin_pct IS NOT excluded.bc_charge_margin_pct
          OR revenue_share_agreements.active IS NOT 1`
    )
    .run(
      id,
      agreement.partnerId,
      agreement.siteId,
      pass,
      partnerPct,
      bcPct,
      now,
      now
    );
  let resolvedId = id;
  if (write.changes === 0) {
    const existing = db()
      .sqliteDb.prepare(
        `SELECT id FROM revenue_share_agreements WHERE partner_id = ? AND site_id = ?`
      )
      .get(agreement.partnerId, agreement.siteId);
    if (existing?.id) resolvedId = existing.id;
  } else {
    // INSERT or real UPDATE — prefer row id (conflict keeps prior PK).
    const row = db()
      .sqliteDb.prepare(
        `SELECT id FROM revenue_share_agreements WHERE partner_id = ? AND site_id = ?`
      )
      .get(agreement.partnerId, agreement.siteId);
    if (row?.id) resolvedId = row.id;
  }
  return { ...agreement, id: resolvedId };
}

export async function getAgreementForSite(siteId) {
  const sql = `SELECT * FROM revenue_share_agreements WHERE site_id = ? AND active = 1 LIMIT 1`;
  const row = db().isPostgres
    ? (await db().pgPool.query(sql.replace('?', '$1'), [siteId])).rows[0]
    : db().sqliteDb.prepare(sql).get(siteId);
  if (!row) return null;
  return {
    id: row.id,
    partnerId: row.partner_id,
    siteId: row.site_id,
    energyCostPassThrough: Boolean(row.energy_cost_pass_through),
    partnerMarginPercentage: Number(row.partner_margin_pct),
    bcChargeMarginPercentage: Number(row.bc_charge_margin_pct),
  };
}

/**
 * Split berechnen, speichern und auditieren.
 */
export async function distributeSessionRevenue({
  sessionId,
  siteId,
  calculation,
  actualEnergyCost,
  agreement: agreementOverride,
}) {
  const agreement = agreementOverride ?? (await getAgreementForSite(siteId));
  if (!agreement) {
    throw new Error(`Kein Revenue-Share-Agreement für siteId=${siteId}`);
  }

  const result = calculateSplit(calculation, agreement, actualEnergyCost);
  const id = `rsd_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  const json = JSON.stringify(result);

  if (db().isPostgres) {
    await db().pgPool.query(
      `INSERT INTO revenue_share_distributions
       (id, session_id, agreement_id, site_id, partner_id, result_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, sessionId, agreement.id ?? null, siteId, agreement.partnerId, json, now]
    );
  } else {
    db().sqliteDb
      .prepare(
        `INSERT INTO revenue_share_distributions
         (id, session_id, agreement_id, site_id, partner_id, result_json, created_at)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(id, sessionId, agreement.id ?? null, siteId, agreement.partnerId, json, now);
  }

  await logBillingEvent(sessionId, 'REVENUE_SHARE', result.partnerPayout, {
    siteId,
    partnerId: agreement.partnerId,
    bcChargePayout: result.bcChargePayout,
    shareableMargin: result.shareableMargin,
  });

  return { id, sessionId, agreement, result };
}

/** Klassen-API (Prototype-Kompatibilität) */
export class RevenueShareManager {
  calculateSplit(calculation, agreement, actualEnergyCost) {
    return calculateSplit(calculation, agreement, actualEnergyCost);
  }
}
