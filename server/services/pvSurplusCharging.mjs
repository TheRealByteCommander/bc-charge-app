/**
 * PV Surplus Charging — main BC API.
 *
 * Production path: forward surplus to Load-Management (`POST /api/pv-surplus`),
 * which rebalances active stations via OCPP SetChargingProfile.
 *
 * Fallback (LM disabled/unreachable): list active charging+adhoc sessions from
 * local DB and apply ChargingStationMaxProfile limits directly via CitrineOS.
 */

import logger from '../utils/logger.mjs';
import { listActiveChargingTargets } from '../db.mjs';
import {
  isLoadManagementEnabled,
  loadManagementFetch,
} from './loadManagementClient.mjs';
import {
  isRemoteCommandAccepted,
  pickRemoteConfirmation,
} from './citrineosServer.mjs';

/** @type {number} kW */
let currentPvSurplus = 0;
/** @type {string|null} ISO timestamp */
let surplusUpdateTime = null;

const DEFAULT_MIN_STATION_KW = 1.4;
const DEFAULT_ALLOCATION_FACTOR = 1;

/**
 * Injectable collaborators for unit tests (keep production defaults).
 * @typedef {{
 *   isLmEnabled?: () => boolean,
 *   lmFetch?: typeof loadManagementFetch,
 *   listTargets?: () => Promise<Array<{ stationId: string, powerKw?: number, evseId?: number }>>,
 *   citrineosPost?: (path: string, stationId: string, body: unknown, timeoutMs?: number) => Promise<unknown>,
 * }} PvDeps
 */

/** @type {PvDeps} */
let deps = {};

/** @param {PvDeps} [next] */
export function setPvSurplusTestDeps(next = {}) {
  deps = next && typeof next === 'object' ? next : {};
}

function lmEnabled() {
  return typeof deps.isLmEnabled === 'function'
    ? deps.isLmEnabled()
    : isLoadManagementEnabled();
}

function lmFetch(path, opts) {
  return typeof deps.lmFetch === 'function'
    ? deps.lmFetch(path, opts)
    : loadManagementFetch(path, opts);
}

async function listTargets() {
  if (typeof deps.listTargets === 'function') return deps.listTargets();
  return listActiveChargingTargets();
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function allocationFactor() {
  const f = envNumber('PV_SURPLUS_ALLOCATION_FACTOR', DEFAULT_ALLOCATION_FACTOR);
  return Math.min(1, Math.max(0, f));
}

function minStationPowerKw() {
  const m = envNumber('PV_SURPLUS_MIN_STATION_KW', DEFAULT_MIN_STATION_KW);
  return Math.max(0, m);
}

/**
 * @param {number} surplus
 * @returns {{ surplus: number, updateTime: string }}
 */
export function updatePvSurplus(surplus) {
  if (typeof surplus !== 'number' || !Number.isFinite(surplus) || surplus < 0) {
    throw Object.assign(new Error('Invalid surplus value. Must be a non-negative number.'), {
      status: 400,
    });
  }

  currentPvSurplus = surplus;
  surplusUpdateTime = new Date().toISOString();
  logger.info('PV surplus updated', { surplus, updateTime: surplusUpdateTime });
  return { surplus: currentPvSurplus, updateTime: surplusUpdateTime };
}

/**
 * @returns {{ surplus: number, updateTime: string|null }}
 */
export function getCurrentPvSurplus() {
  return {
    surplus: currentPvSurplus,
    updateTime: surplusUpdateTime,
  };
}

/** Test helper — reset in-memory surplus state. */
export function resetPvSurplusState() {
  currentPvSurplus = 0;
  surplusUpdateTime = null;
  deps = {};
}

/**
 * Equal-share surplus budget across N stations (kW per station).
 * Never over-allocates: sum of per-station targets stays ≤ budget
 * (min floor is applied only when affordable fleet-wide).
 * @param {number} surplusKw
 * @param {number} stationCount
 * @param {{ allocationFactor?: number, minStationPowerKw?: number, ceilingKw?: number }} [opts]
 * @returns {number} target kW per station (0 when none / no budget)
 */
export function computePerStationSurplusKw(surplusKw, stationCount, opts = {}) {
  const n = Math.max(0, Math.floor(Number(stationCount) || 0));
  if (n <= 0) return 0;
  const factor =
    typeof opts.allocationFactor === 'number'
      ? Math.min(1, Math.max(0, opts.allocationFactor))
      : allocationFactor();
  const minKw =
    typeof opts.minStationPowerKw === 'number'
      ? Math.max(0, opts.minStationPowerKw)
      : minStationPowerKw();
  const budget = Math.max(0, Number(surplusKw) || 0) * factor;
  if (budget <= 0) return 0;
  const share = budget / n;
  // Min floor only when every station can still fit in the surplus budget.
  // Inflating below-budget shares would pull grid power — wrong for PV surplus.
  let target = share >= minKw && minKw > 0 ? Math.max(minKw, share) : share;
  if (typeof opts.ceilingKw === 'number' && Number.isFinite(opts.ceilingKw) && opts.ceilingKw > 0) {
    target = Math.min(opts.ceilingKw, target);
  }
  return target;
}

/**
 * @param {string} path
 * @param {string} stationId
 * @param {Object} body
 * @param {number} [timeoutMs]
 */
async function citrineosMessage(path, stationId, body, timeoutMs = 12_000) {
  if (typeof deps.citrineosPost === 'function') {
    return deps.citrineosPost(path, stationId, body, timeoutMs);
  }

  if (!process.env.CITRINEOS_API_URL) {
    throw Object.assign(new Error('CitrineOS API nicht konfiguriert'), { status: 503 });
  }

  const base = process.env.CITRINEOS_API_URL.replace(/\/$/, '');
  const url = new URL(path, `${base}/`);
  url.searchParams.set('identifier', stationId);
  url.searchParams.set('tenantId', String(process.env.CITRINEOS_TENANT_ID ?? '1'));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String(/** @type {any} */ (parsed).message)
        : `CitrineOS ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return parsed;
}

/**
 * OCPP 2.0.1 station-wide cap (parity with LoadManager.sendSetChargingProfile).
 * @param {string} stationId
 * @param {number} targetPowerKw
 * @param {{ evseId?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function setStationMaxProfileKw(stationId, targetPowerKw, opts = {}) {
  const kw = Number(targetPowerKw);
  if (!stationId || !Number.isFinite(kw) || kw < 0) return false;

  const evseId =
    typeof opts.evseId === 'number' && Number.isFinite(opts.evseId) ? opts.evseId : 0;

  const chargingProfile = {
    chargingProfileId: Math.floor(Date.now() / 1000) % 2_000_000_000,
    stackLevel: 1,
    chargingProfilePurpose: 'ChargingStationMaxProfile',
    chargingProfileKind: 'Absolute',
    chargingSchedule: {
      startSchedule: new Date().toISOString(),
      chargingRateUnit: 'W',
      chargingSchedulePeriod: [
        {
          startPeriod: 0,
          limit: Math.round(kw * 1000),
          numberPhases: 3,
        },
      ],
    },
  };

  try {
    const result = await citrineosMessage(
      '/ocpp/2.0.1/smartcharging/setChargingProfile',
      stationId,
      { evseId, chargingProfile },
      10_000
    );
    const confirmation = pickRemoteConfirmation(result);
    const ok = isRemoteCommandAccepted(result) || isRemoteCommandAccepted(confirmation);
    if (!ok) {
      logger.warn('SetChargingProfile not accepted for PV surplus', {
        stationId,
        targetPowerKw: kw,
        result,
      });
    }
    return ok;
  } catch (error) {
    logger.warn('SetChargingProfile failed for PV surplus', {
      stationId,
      targetPowerKw: kw,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Forward surplus to Load-Management service.
 * @param {number} surplusKw
 */
export async function forwardSurplusToLoadManagement(surplusKw) {
  if (!lmEnabled()) {
    return { ok: false, skipped: 'lm_disabled', status: 0, data: null, error: null };
  }
  const r = await lmFetch('/api/pv-surplus', {
    method: 'POST',
    body: { surplus: surplusKw },
    timeoutMs: 12_000,
  });
  return {
    ok: r.ok,
    skipped: null,
    status: r.status,
    data: r.data,
    error: r.error,
  };
}

/**
 * Apply equal-share limits via LM per-station limit API.
 * @param {Array<{ stationId: string, powerKw?: number }>} targets
 * @param {number} perStationKw
 */
async function applyLimitsViaLoadManagement(targets, perStationKw) {
  /** @type {Array<{ stationId: string, ok: boolean, error?: string|null }>} */
  const results = [];
  await Promise.all(
    targets.map(async (t) => {
      const ceiling =
        typeof t.powerKw === 'number' && t.powerKw > 0 ? t.powerKw : undefined;
      const maxPowerKw =
        ceiling != null ? Math.min(ceiling, perStationKw) : perStationKw;
      const id = encodeURIComponent(t.stationId);
      const r = await lmFetch(`/api/load/limit/${id}`, {
        method: 'POST',
        body: { maxPowerKw },
        timeoutMs: 12_000,
      });
      results.push({
        stationId: t.stationId,
        ok: r.ok,
        error: r.error,
      });
    })
  );
  return results;
}

/**
 * @param {Array<{ stationId: string, powerKw?: number, evseId?: number }>} targets
 * @param {number} perStationKw
 */
async function applyLimitsViaCitrineos(targets, perStationKw) {
  /** @type {Array<{ stationId: string, ok: boolean, error?: string|null }>} */
  const results = [];
  for (const t of targets) {
    const ceiling =
      typeof t.powerKw === 'number' && t.powerKw > 0 ? t.powerKw : undefined;
    const maxPowerKw =
      ceiling != null ? Math.min(ceiling, perStationKw) : perStationKw;
    const ok = await setStationMaxProfileKw(t.stationId, maxPowerKw, {
      evseId: 0,
    });
    results.push({
      stationId: t.stationId,
      ok,
      error: ok ? null : 'setChargingProfile_failed',
    });
  }
  return results;
}

/**
 * Optimize charging from current (or provided) PV surplus.
 * @param {{ surplus?: number, targets?: Array<{ stationId: string, powerKw?: number, evseId?: number }> }} [opts]
 *   When `targets` is provided (including `[]`), DB is not queried.
 */
export async function optimizeChargingWithPvSurplus(opts = {}) {
  const surplus =
    typeof opts.surplus === 'number' && Number.isFinite(opts.surplus)
      ? opts.surplus
      : getCurrentPvSurplus().surplus;

  if (typeof opts.surplus === 'number' && Number.isFinite(opts.surplus) && opts.surplus >= 0) {
    updatePvSurplus(opts.surplus);
  }

  // Preferred: LM owns live station set + OCPP WS profiles.
  if (lmEnabled()) {
    const forwarded = await forwardSurplusToLoadManagement(surplus);
    if (forwarded.ok) {
      return {
        success: true,
        mode: 'load_management',
        message: `PV surplus ${surplus} kW forwarded to Load-Management`,
        surplus,
        sessionsAffected: null,
        stations: [],
        lm: { status: forwarded.status, data: forwarded.data },
      };
    }
    logger.warn('LM PV surplus forward failed — falling back to DB targets', {
      error: forwarded.error,
      status: forwarded.status,
      skipped: forwarded.skipped,
    });
  }

  const targets = Array.isArray(opts.targets) ? opts.targets : await listTargets();

  if (!targets.length) {
    return {
      success: true,
      mode: 'idle',
      message: 'No active charging sessions found',
      surplus,
      sessionsAffected: 0,
      stations: [],
    };
  }

  // surplus <= 0 still applies caps (0 kW) so prior PV boosts do not stick after sunset/clouds.
  const perStationKw = computePerStationSurplusKw(surplus, targets.length);
  const zeroSurplus = !(surplus > 0) || perStationKw <= 0;

  /** @type {Array<{ stationId: string, ok: boolean, error?: string|null }>} */
  let results = [];
  /** @type {string} */
  let mode = 'citrineos_direct';

  if (lmEnabled()) {
    results = await applyLimitsViaLoadManagement(targets, perStationKw);
    mode = zeroSurplus ? 'no_surplus_limits' : 'load_management_limits';
    const anyOk = results.some((r) => r.ok);
    if (!anyOk) {
      results = await applyLimitsViaCitrineos(targets, perStationKw);
      mode = zeroSurplus ? 'no_surplus_citrineos' : 'citrineos_direct';
    }
  } else {
    results = await applyLimitsViaCitrineos(targets, perStationKw);
    if (zeroSurplus) mode = 'no_surplus_citrineos';
  }

  const sessionsAffected = results.filter((r) => r.ok).length;

  return {
    success: sessionsAffected > 0 || results.length === 0,
    mode,
    message: zeroSurplus
      ? `No PV surplus — applied ${perStationKw.toFixed(2)} kW cap on ${targets.length} station(s)`
      : `Distributed ${surplus} kW PV surplus across ${targets.length} station(s) (~${perStationKw.toFixed(2)} kW each)`,
    surplus,
    sessionsAffected,
    perStationKw,
    stations: results,
  };
}

/**
 * Update surplus and optionally apply immediately.
 * @param {number} surplus
 * @param {{ apply?: boolean }} [opts]
 */
export async function reportPvSurplus(surplus, opts = {}) {
  const stored = updatePvSurplus(surplus);
  const apply = opts.apply !== false; // default: apply on report

  if (!apply) {
    return {
      success: true,
      applied: false,
      data: stored,
      optimize: null,
    };
  }

  // Prefer LM forward without requiring local session rows.
  if (lmEnabled()) {
    const forwarded = await forwardSurplusToLoadManagement(surplus);
    if (forwarded.ok) {
      return {
        success: true,
        applied: true,
        mode: 'load_management',
        data: stored,
        optimize: {
          success: true,
          mode: 'load_management',
          message: `PV surplus ${surplus} kW forwarded to Load-Management`,
          surplus,
          sessionsAffected: null,
        },
        lm: { status: forwarded.status, data: forwarded.data },
      };
    }
  }

  const optimize = await optimizeChargingWithPvSurplus({ surplus });
  return {
    success: true,
    applied: true,
    mode: optimize.mode,
    data: stored,
    optimize,
  };
}

export default {
  updatePvSurplus,
  getCurrentPvSurplus,
  resetPvSurplusState,
  setPvSurplusTestDeps,
  computePerStationSurplusKw,
  setStationMaxProfileKw,
  forwardSurplusToLoadManagement,
  optimizeChargingWithPvSurplus,
  reportPvSurplus,
};
