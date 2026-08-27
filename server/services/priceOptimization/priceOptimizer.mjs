/**
 * Price-based charging optimization service for CitrineOS
 *
 * This service implements time-based charging optimization by:
 * 1. Fetching day-ahead electricity prices from external APIs
 * 2. Determining optimal charging windows based on price thresholds
 * 3. Pausing or throttling charging during high-price periods
 * 4. Resuming charging during low-price periods
 *
 * OCPP SetChargingProfile parity: chargingRateUnit "W" → period.limit is Watts
 * (same as LoadManager / PV surplus). Never label W and send kW.
 */

import { safeParseResponseJsonAllowText } from '../../utils/safeJson.mjs';
import {
  isRemoteCommandAccepted,
  pickRemoteConfirmation,
} from '../citrineosServer.mjs';

// Default configuration
const PRICE_OPTIMIZATION_CONFIG = {
  // Price threshold in EUR/kWh above which charging should be paused
  priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_EUR_PER_KWH ?? '0.35'),
  // Hysteresis to prevent frequent switching (in EUR/kWh)
  hysteresis: parseFloat(process.env.PRICE_HYSTERESIS_EUR ?? '0.02'),
  // Minimum charging power when throttling (percentage of max power)
  minChargingPowerPercent: parseInt(process.env.MIN_CHARGING_POWER_PERCENT ?? '20', 10),
  // API endpoint for electricity prices
  priceApiUrl: process.env.ELECTRICITY_PRICE_API_URL ?? 'https://api.energy-price-data.de/day-ahead',
  // How often to check prices (in minutes)
  priceCheckIntervalMinutes: parseInt(process.env.PRICE_CHECK_INTERVAL_MINUTES ?? '15', 10),
};

/**
 * @typedef {{ timestamp: string, price: number }} ElectricityPricePoint
 */

/**
 * Injectable collaborators for unit tests (keep production defaults).
 * @typedef {{
 *   citrineosPost?: (path: string, stationId: string, body: unknown, timeoutMs?: number) => Promise<unknown>,
 *   fetchPrices?: () => Promise<ElectricityPricePoint[]>,
 * }} PriceOptDeps
 */

/** @type {PriceOptDeps} */
let deps = {};

/** @param {PriceOptDeps} [next] */
export function setPriceOptimizerTestDeps(next = {}) {
  deps = next && typeof next === 'object' ? next : {};
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parse-don't-cast external day-ahead price payloads.
 * Accepts bare arrays or common envelopes `{ prices|data|items: [...] }`.
 * Drops corrupt rows; returns [] if nothing valid remains.
 * @param {unknown} raw
 * @returns {ElectricityPricePoint[]}
 */
export function normalizeElectricityPriceData(raw) {
  let list = null;
  if (Array.isArray(raw)) {
    list = raw;
  } else if (isPlainObject(raw)) {
    const nested = raw.prices ?? raw.data ?? raw.items ?? raw.results;
    if (Array.isArray(nested)) list = nested;
  }
  if (!list) return [];

  /** @type {ElectricityPricePoint[]} */
  const out = [];
  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const priceRaw = item.price ?? item.value ?? item.eurPerKwh ?? item.eur_per_kwh;
    const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
    if (!Number.isFinite(price)) continue;

    const tsRaw = item.timestamp ?? item.time ?? item.startsAt ?? item.starts_at ?? item.date;
    if (tsRaw == null || tsRaw === '') continue;
    const d = new Date(/** @type {string|number|Date} */ (tsRaw));
    if (Number.isNaN(d.getTime())) continue;

    out.push({ timestamp: d.toISOString(), price });
  }
  return out;
}

/**
 * Build OCPP 2.0.1 SetChargingProfile body for price throttle/pause.
 * `chargingRateUnit: "W"` ⇒ `limit` is Watts (parity LM/PV).
 *
 * @param {{
 *   evseId?: number,
 *   targetPowerWatts: number|null,
 *   chargingProfileId?: number,
 *   startSchedule?: string,
 * }} opts
 * @returns {{ evseId: number, chargingProfile: Record<string, unknown> }}
 */
export function buildPriceChargingProfile(opts) {
  const evseRaw = opts.evseId;
  const evseId =
    typeof evseRaw === 'number' && Number.isFinite(evseRaw) && evseRaw >= 0
      ? Math.trunc(evseRaw)
      : 0;

  const wattsRaw = opts.targetPowerWatts;
  const limitW =
    wattsRaw == null
      ? 0
      : Math.max(0, Math.round(Number(wattsRaw)));
  const safeLimitW = Number.isFinite(limitW) ? limitW : 0;

  const profileId =
    typeof opts.chargingProfileId === 'number' && Number.isFinite(opts.chargingProfileId)
      ? Math.trunc(opts.chargingProfileId) % 2_000_000_000
      : Math.floor(Date.now() / 1000) % 2_000_000_000;

  const startSchedule =
    typeof opts.startSchedule === 'string' && opts.startSchedule.trim()
      ? opts.startSchedule.trim()
      : new Date().toISOString();

  return {
    evseId,
    chargingProfile: {
      chargingProfileId: profileId,
      stackLevel: 1,
      // TxProfile: active transaction throttle (price window), not station-wide max.
      chargingProfilePurpose: 'TxProfile',
      chargingProfileKind: 'Absolute',
      chargingSchedule: {
        startSchedule,
        // OCPP: unit W ⇒ period.limit in Watts (do NOT divide by 1000).
        chargingRateUnit: 'W',
        chargingSchedulePeriod: [
          {
            startPeriod: 0,
            limit: safeLimitW,
            numberPhases: 3,
          },
        ],
      },
    },
  };
}

/**
 * Send OCPP message to CitrineOS
 * @param {string} path - API path
 * @param {string} stationId - Station identifier
 * @param {Object} body - Request body
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Response from CitrineOS
 */
async function citrineosMessage(path, stationId, body, timeoutMs = 12_000) {
  if (typeof deps.citrineosPost === 'function') {
    return deps.citrineosPost(path, stationId, body, timeoutMs);
  }

  if (!process.env.CITRINEOS_API_URL) {
    throw Object.assign(new Error('CitrineOS API nicht konfiguriert'), { status: 503 });
  }

  const url = new URL(path, `${process.env.CITRINEOS_API_URL.replace(/\/$/, '')}/`);
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
  const parsed = safeParseResponseJsonAllowText(text, null);
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String(/** @type {{ message?: unknown }} */ (parsed).message)
        : `CitrineOS ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return parsed;
}

/**
 * Fetch day-ahead electricity prices
 * @returns {Promise<ElectricityPricePoint[]>} Array of price data points
 */
export async function fetchElectricityPrices() {
  if (typeof deps.fetchPrices === 'function') {
    return deps.fetchPrices();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(PRICE_OPTIMIZATION_CONFIG.priceApiUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BC-Charge-Price-Optimizer/1.0',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Price API returned ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const data = safeParseResponseJsonAllowText(text, null);
    const prices = normalizeElectricityPriceData(data);
    if (prices.length === 0) {
      throw new Error('Invalid price data format: no usable price points');
    }
    return prices;
  } catch (error) {
    console.error('Failed to fetch electricity prices:', error);
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch electricity prices: ${msg}`);
  }
}

/**
 * Get current electricity price based on timestamp
 * @param {ElectricityPricePoint[]} prices - Price data
 * @param {Date} timestamp - Current time
 * @returns {number|null} Current price or null if not available
 */
export function getCurrentPrice(prices, timestamp) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return null;
  }

  const now = timestamp.getTime();
  if (!Number.isFinite(now)) return null;

  // Copy before sort — never mutate caller arrays.
  const sortedPrices = [...prices].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < sortedPrices.length - 1; i++) {
    const current = new Date(sortedPrices[i].timestamp).getTime();
    const next = new Date(sortedPrices[i + 1].timestamp).getTime();
    if (!Number.isFinite(current) || !Number.isFinite(next)) continue;

    if (now >= current && now < next) {
      return sortedPrices[i].price;
    }
  }

  const lastPrice = sortedPrices[sortedPrices.length - 1];
  if (now >= new Date(lastPrice.timestamp).getTime()) {
    return lastPrice.price;
  }

  return null;
}

/**
 * Determine if charging should be paused based on current price
 * @param {number|null} currentPrice - Current electricity price in EUR/kWh
 * @param {boolean} isCurrentlyPaused - Whether charging is currently paused
 * @returns {boolean} True if charging should be paused, false otherwise
 */
export function shouldPauseCharging(currentPrice, isCurrentlyPaused) {
  if (currentPrice === null || !Number.isFinite(currentPrice)) {
    // If we can't determine the price, continue charging
    return false;
  }

  const threshold = PRICE_OPTIMIZATION_CONFIG.priceThreshold;
  const hysteresis = PRICE_OPTIMIZATION_CONFIG.hysteresis;

  if (isCurrentlyPaused) {
    // Use lower threshold to resume (hysteresis)
    return currentPrice > threshold - hysteresis;
  }
  // Use higher threshold to pause
  return currentPrice > threshold + hysteresis;
}

/**
 * Send charging profile to pause or throttle charging
 * @param {string} stationId - OCPP station identifier
 * @param {number} evseId - EVSE identifier
 * @param {number} _connectorId - Connector identifier (reserved; TxProfile is EVSE-scoped)
 * @param {number|null} targetPowerWatts - Target power in watts (null to pause → 0 W)
 * @returns {Promise<boolean>} True if successful
 */
export async function setChargingProfile(stationId, evseId, _connectorId, targetPowerWatts) {
  if (!stationId || typeof stationId !== 'string') return false;

  try {
    const body = buildPriceChargingProfile({
      evseId,
      targetPowerWatts,
    });

    const result = await citrineosMessage(
      '/ocpp/2.0.1/smartcharging/setChargingProfile',
      stationId,
      body,
      10000
    );

    const confirmation = pickRemoteConfirmation(result);
    const success =
      isRemoteCommandAccepted(result) || isRemoteCommandAccepted(confirmation);

    if (!success) {
      console.warn(`SetChargingProfile command failed for station ${stationId}`, result);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to set charging profile for station ${stationId}:`, error);
    return false;
  }
}

/**
 * Optimize charging for a specific station and connector
 * @param {string} stationId - OCPP station identifier
 * @param {number} evseId - EVSE identifier
 * @param {number} connectorId - Connector identifier
 * @param {number} maxPowerWatts - Maximum power in watts for this connector
 * @param {boolean} isCurrentlyPaused - Whether charging is currently paused
 * @returns {Promise<{shouldPause: boolean, currentPrice: number|null, targetPowerWatts: number|null}>}
 */
export async function optimizeChargingForConnector(
  stationId,
  evseId,
  connectorId,
  maxPowerWatts,
  isCurrentlyPaused
) {
  const maxW = Number(maxPowerWatts);
  const safeMaxW = Number.isFinite(maxW) && maxW > 0 ? maxW : 0;

  try {
    const prices = await fetchElectricityPrices();
    const currentPrice = getCurrentPrice(prices, new Date());
    const shouldPause = shouldPauseCharging(currentPrice, Boolean(isCurrentlyPaused));

    let targetPowerWatts;
    if (shouldPause) {
      const minPowerPercent = PRICE_OPTIMIZATION_CONFIG.minChargingPowerPercent / 100;
      targetPowerWatts = Math.round(safeMaxW * minPowerPercent);
    } else {
      targetPowerWatts = safeMaxW;
    }

    // Only send profile if it would change the current state
    if (
      (shouldPause && !isCurrentlyPaused) ||
      (!shouldPause && isCurrentlyPaused)
    ) {
      await setChargingProfile(stationId, evseId, connectorId, targetPowerWatts);
    }

    return {
      shouldPause,
      currentPrice,
      targetPowerWatts,
    };
  } catch (error) {
    console.error(`Failed to optimize charging for station ${stationId}:`, error);

    // In case of error, continue normal charging
    return {
      shouldPause: false,
      currentPrice: null,
      targetPowerWatts: safeMaxW,
    };
  }
}

/**
 * Get price optimization configuration
 * @returns {Object} Current configuration
 */
export function getPriceOptimizationConfig() {
  return { ...PRICE_OPTIMIZATION_CONFIG };
}

/**
 * Update price optimization configuration
 * @param {Object} newConfig - New configuration values
 */
export function updatePriceOptimizationConfig(newConfig) {
  if (!isPlainObject(newConfig)) return;
  Object.assign(PRICE_OPTIMIZATION_CONFIG, newConfig);
}

export default {
  optimizeChargingForConnector,
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig,
  fetchElectricityPrices,
  normalizeElectricityPriceData,
  buildPriceChargingProfile,
  getCurrentPrice,
  shouldPauseCharging,
  setChargingProfile,
  setPriceOptimizerTestDeps,
};
