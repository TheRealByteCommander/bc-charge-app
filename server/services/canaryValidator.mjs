/**
 * Canary API validation — sampled Zod checks against live CitrineOS/Hasura payloads.
 * Detects upstream schema drift without blocking the critical path (graceful degrade).
 *
 * Env:
 *   CANARY_SAMPLE_RATE   0..1 (default 0.1 = 10%)
 *   CANARY_FORCE         "1" forces 100% sampling (tests/debug)
 *   CANARY_DISABLED      "1" disables validation
 *   CANARY_PIN_MIN_SAMPLES / CANARY_PIN_MAX_FAIL_RATE / CANARY_PIN_REQUIRE_FORCE
 *                        pin-bump readiness gate (see evaluatePinBumpReadiness)
 */

import { canarySchemas } from './citrineosSchemas.mjs';
import {
  CITRINEOS_INTEGRATION_VERSION,
  CITRINEOS_UPSTREAM_MERGED_NEXT,
  CITRINEOS_UPSTREAM_OPEN,
  CITRINEOS_UPSTREAM_WATCH,
} from '../contracts/citrineosContract.mjs';
import {
  evaluateDataApiMigrationReadiness,
  summarizeDataApiMigration,
  CITRINEOS_DATA_API_MIGRATION,
} from '../contracts/citrineosDataApiMigration.mjs';
import logger from '../utils/logger.mjs';

const recentMismatches = [];
const MAX_RECENT = 50;

/** @type {Map<string, { ok: number, fail: number, lastFailAt: string | null, lastOkAt: string | null }>} */
const statsBySchema = new Map();

function nowIso() {
  return new Date().toISOString();
}

function sampleRate() {
  if (process.env.CANARY_FORCE === '1' || process.env.CANARY_FORCE === 'true') return 1;
  const raw = process.env.CANARY_SAMPLE_RATE;
  if (raw == null || raw === '') return 0.1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.1;
  return Math.min(1, Math.max(0, n));
}

function isDisabled() {
  return process.env.CANARY_DISABLED === '1' || process.env.CANARY_DISABLED === 'true';
}

function shouldSample() {
  if (isDisabled()) return false;
  const rate = sampleRate();
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return Math.random() < rate;
}

function ensureStat(schemaId) {
  let s = statsBySchema.get(schemaId);
  if (!s) {
    s = { ok: 0, fail: 0, lastFailAt: null, lastOkAt: null };
    statsBySchema.set(schemaId, s);
  }
  return s;
}

function flattenZodError(error) {
  try {
    return error.flatten?.() ?? { formErrors: [String(error.message ?? error)], fieldErrors: {} };
  } catch {
    return { formErrors: [String(error?.message ?? error)], fieldErrors: {} };
  }
}

function failRate(fail, total) {
  if (!total) return 0;
  return fail / total;
}

/**
 * Sampled validation. Never throws. Returns result when sampled, else skipped.
 * @param {string} schemaId key in canarySchemas
 * @param {unknown} payload raw upstream value
 * @param {{ source?: string, meta?: Record<string, unknown> }} [ctx]
 * @returns {{ sampled: boolean, ok: boolean | null, schemaId: string, issues?: unknown }}
 */
export function canaryValidate(schemaId, payload, ctx = {}) {
  const schema = canarySchemas[schemaId];
  if (!schema) {
    logger.warn('[Canary] Unknown schema id', { schemaId });
    return { sampled: false, ok: null, schemaId };
  }

  if (!shouldSample()) {
    return { sampled: false, ok: null, schemaId };
  }

  const parsed = schema.safeParse(payload);
  const stat = ensureStat(schemaId);
  const source = ctx.source ?? 'unknown';

  if (parsed.success) {
    stat.ok += 1;
    stat.lastOkAt = nowIso();
    return { sampled: true, ok: true, schemaId };
  }

  stat.fail += 1;
  stat.lastFailAt = nowIso();
  const issues = flattenZodError(parsed.error);
  const entry = {
    at: stat.lastFailAt,
    schemaId,
    source,
    meta: ctx.meta ?? {},
    issues,
    payloadKeys:
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? Object.keys(payload).slice(0, 40)
        : typeof payload,
  };
  recentMismatches.unshift(entry);
  if (recentMismatches.length > MAX_RECENT) recentMismatches.length = MAX_RECENT;

  logger.warn('[Canary] Upstream schema mismatch (possible API drift)', {
    schemaId,
    source,
    meta: ctx.meta ?? {},
    issues,
    payloadKeys: entry.payloadKeys,
  });

  return { sampled: true, ok: false, schemaId, issues };
}

/**
 * Always validate (no sampling). For tests and forced paths. Still never throws.
 */
export function canaryValidateAlways(schemaId, payload, ctx = {}) {
  const prev = process.env.CANARY_FORCE;
  process.env.CANARY_FORCE = '1';
  try {
    return canaryValidate(schemaId, payload, ctx);
  } finally {
    if (prev === undefined) delete process.env.CANARY_FORCE;
    else process.env.CANARY_FORCE = prev;
  }
}

/**
 * Gate for bumping CITRINEOS_INTEGRATION_VERSION / cutting over toward upstreamWatch.
 * Staging soak with CANARY_FORCE=1 before any pin bump.
 *
 * Env:
 *   CANARY_PIN_MIN_SAMPLES   default 50
 *   CANARY_PIN_MAX_FAIL_RATE default 0.02
 *   CANARY_PIN_REQUIRE_FORCE default 1 (ready only when CANARY_FORCE=1)
 */
export function evaluatePinBumpReadiness(opts = {}) {
  const minSamples = Number(opts.minSamples ?? process.env.CANARY_PIN_MIN_SAMPLES ?? 50);
  const maxFailRate = Number(opts.maxFailRate ?? process.env.CANARY_PIN_MAX_FAIL_RATE ?? 0.02);
  const requireForce =
    opts.requireForce != null
      ? Boolean(opts.requireForce)
      : process.env.CANARY_PIN_REQUIRE_FORCE !== '0' &&
        process.env.CANARY_PIN_REQUIRE_FORCE !== 'false';

  let ok = 0;
  let fail = 0;
  const perSchema = {};
  for (const [id, s] of statsBySchema.entries()) {
    ok += s.ok;
    fail += s.fail;
    const total = s.ok + s.fail;
    perSchema[id] = {
      ok: s.ok,
      fail: s.fail,
      total,
      failRate: total > 0 ? failRate(s.fail, total) : 0,
    };
  }
  const total = ok + fail;
  const rate = total > 0 ? failRate(fail, total) : 1;
  const forceOn = process.env.CANARY_FORCE === '1' || process.env.CANARY_FORCE === 'true';
  const disabled = isDisabled();

  /** @type {string[]} */
  const blockers = [];
  if (disabled) blockers.push('CANARY_DISABLED');
  if (requireForce && !forceOn) blockers.push('CANARY_FORCE_REQUIRED');
  if (total < minSamples) blockers.push(`MIN_SAMPLES(${total}<${minSamples})`);
  if (total > 0 && rate > maxFailRate) {
    blockers.push(`FAIL_RATE(${rate.toFixed(4)}>${maxFailRate})`);
  }
  for (const [id, s] of Object.entries(perSchema)) {
    if (s.total >= 5 && s.failRate > maxFailRate) {
      blockers.push(`SCHEMA_FAIL:${id}`);
    }
  }

  // Structural #849 /data/** gate — even a clean canary soak must not greenlight a pin bump
  // while legacy Data-API routes still block cutover.
  const dataApi = evaluateDataApiMigrationReadiness();
  if (!dataApi.ready) {
    for (const b of dataApi.blockers) {
      if (!blockers.includes(b)) blockers.push(b);
    }
  }

  return {
    ready: blockers.length === 0 && total > 0,
    blockers,
    totals: { ok, fail, total, failRate: rate },
    thresholds: { minSamples, maxFailRate, requireForce },
    forceOn,
    dataApiMigration: {
      ready: dataApi.ready,
      blockers: dataApi.blockers,
      blockingRouteIds: dataApi.blockingRouteIds,
      upstreamPr: dataApi.upstreamPr,
    },
    disabled,
    perSchema,
    guidance:
      blockers.length === 0
        ? 'Canary soak looks clean — pin bump / v2 cutover may proceed with explicit review.'
        : 'Do not bump CITRINEOS_INTEGRATION_VERSION until blockers are cleared (staging CANARY_FORCE=1 soak).',
  };
}

export function getCanaryStats() {
  const bySchema = {};
  for (const [id, s] of statsBySchema.entries()) {
    bySchema[id] = { ...s, total: s.ok + s.fail };
  }
  return {
    disabled: isDisabled(),
    sampleRate: sampleRate(),
    bySchema,
    recentMismatches: recentMismatches.slice(0, 20),
    pinBump: evaluatePinBumpReadiness(),
    /** Informational — pin stays CITRINEOS_INTEGRATION_VERSION until pinBump.ready. */
    integrationVersion: CITRINEOS_INTEGRATION_VERSION,
    upstreamWatch: CITRINEOS_UPSTREAM_WATCH,
    upstreamOpen: CITRINEOS_UPSTREAM_OPEN,
    /** Merged to upstream `next` but not yet in CITRINEOS_UPSTREAM_WATCH tag. */
    upstreamMergedNext: CITRINEOS_UPSTREAM_MERGED_NEXT,
    /** Structural #849 /data/** migration matrix (does not change runtime routing). */
    dataApiMigration: {
      ...summarizeDataApiMigration(),
      readiness: evaluateDataApiMigrationReadiness(),
      title: CITRINEOS_DATA_API_MIGRATION.title,
      upstreamUrl: CITRINEOS_DATA_API_MIGRATION.upstreamUrl,
      cutoverChecklist: CITRINEOS_DATA_API_MIGRATION.cutoverChecklist,
    },
  };
}

/** Test helper — clear in-memory state. */
export function resetCanaryStats() {
  statsBySchema.clear();
  recentMismatches.length = 0;
}

export default {
  canaryValidate,
  canaryValidateAlways,
  getCanaryStats,
  evaluatePinBumpReadiness,
  resetCanaryStats,
};
