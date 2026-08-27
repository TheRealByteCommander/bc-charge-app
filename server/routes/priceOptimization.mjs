/**
 * Price-based charging optimization routes for CitrineOS
 * Mount: /api/price-optimization
 *
 * Also re-exported under /api/citrineos/* aliases so the frontend client
 * (`src/api/priceOptimization/client.ts`) hits live handlers.
 */

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.mjs';
import {
  optimizeChargingForConnector,
  computeChargingRecommendation,
  normalizeMaxPowerWatts,
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig,
  sanitizePriceOptimizationConfigUpdate,
  fetchElectricityPrices as fetchOptimizerPrices,
} from '../services/priceOptimization/priceOptimizer.mjs';
import { parseConnectorRef } from '../utils/connectorRef.mjs';

const router = Router();

/** Default catalog max until station power is wired through. */
const DEFAULT_MAX_POWER_WATTS = 22000;

/**
 * Resolve stationId + connectorAppId → { stationId, evseId, connectorId }.
 * @param {unknown} stationIdRaw
 * @param {unknown} connectorIdRaw
 * @returns {{ ok: true, stationId: string, evseId: number, connectorId: number } | { ok: false, status: number, error: string }}
 */
function resolveStationConnector(stationIdRaw, connectorIdRaw) {
  const stationId =
    stationIdRaw == null ? '' : String(stationIdRaw).trim();
  if (!stationId) {
    return { ok: false, status: 400, error: 'stationId and connectorId are required' };
  }
  const ref = parseConnectorRef(connectorIdRaw);
  if (!ref) {
    return {
      ok: false,
      status: 400,
      error:
        'Invalid connectorId (expected evse-{n}-conn-{m} or non-negative integer)',
    };
  }
  return {
    ok: true,
    stationId,
    evseId: ref.evseId,
    connectorId: ref.connectorId,
  };
}

/**
 * Parse optional maxPowerWatts (query/body). Invalid/missing → default catalog max.
 * @param {unknown} raw
 * @returns {number}
 */
function resolveMaxPowerWatts(raw) {
  if (raw == null || raw === '') return DEFAULT_MAX_POWER_WATTS;
  const n = normalizeMaxPowerWatts(raw);
  // Cap absurd values (MW-class) so bad clients cannot request runaway limits.
  if (n <= 0) return DEFAULT_MAX_POWER_WATTS;
  return Math.min(n, 500_000);
}

/**
 * Parse paused flag from query/body (boolean or common string forms).
 * @param {unknown} raw
 * @returns {boolean}
 */
function resolvePausedFlag(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null || raw === '') return false;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  }
  return Boolean(raw);
}

/**
 * GET /api/price-optimization/price-data
 * Fetch day-ahead electricity prices (optimizer source; falls back internally).
 */
/** Local synthetic day-ahead series when external price API is down. */
function buildFallbackPriceSeries() {
  const now = new Date();
  const prices = [];
  for (let i = 0; i < 24; i += 1) {
    const hour = new Date(now);
    hour.setHours(now.getHours() + i, 0, 0, 0);
    const hourOfDay = hour.getHours();
    const price =
      hourOfDay >= 7 && hourOfDay <= 20
        ? 0.3 + (i % 5) * 0.02
        : 0.2 + (i % 4) * 0.015;
    prices.push({
      timestamp: hour.toISOString(),
      price: Number(price.toFixed(4)),
    });
  }
  return prices;
}

router.get('/price-data', optionalAuth, async (_req, res) => {
  try {
    const prices = await fetchOptimizerPrices();
    res.json({ prices, source: 'api' });
  } catch (error) {
    console.warn(
      'Price API unavailable — serving synthetic fallback series',
      error instanceof Error ? error.message : error
    );
    res.json({ prices: buildFallbackPriceSeries(), source: 'fallback' });
  }
});

/**
 * GET /api/price-optimization/config
 * Get price optimization configuration
 */
router.get('/config', requireAuth, (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const config = getPriceOptimizationConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting price optimization config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * POST /api/price-optimization/config
 * Update price optimization configuration
 */
router.post('/config', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const sanitized = sanitizePriceOptimizationConfigUpdate(req.body);
    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({
        error:
          'No valid config fields (priceThreshold, hysteresis, minChargingPowerPercent, priceApiUrl, priceCheckIntervalMinutes)',
      });
    }

    const config = updatePriceOptimizationConfig(sanitized);
    res.json({ message: 'Configuration updated successfully', config });
  } catch (error) {
    console.error('Error updating price optimization config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/price-optimization/charging-recommendation
 * Read-only recommendation for a connector (never SetChargingProfile).
 */
router.get('/charging-recommendation', optionalAuth, async (req, res) => {
  const resolved = resolveStationConnector(req.query.stationId, req.query.connectorId);
  if (!resolved.ok) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  try {
    const maxPowerWatts = resolveMaxPowerWatts(req.query.maxPowerWatts);
    const isCurrentlyPaused = resolvePausedFlag(req.query.isCurrentlyPaused);

    // Read-only: UI polls must not mutate charger state via SetChargingProfile.
    const result = await computeChargingRecommendation(
      maxPowerWatts,
      isCurrentlyPaused
    );

    res.json({
      ...result,
      stationId: resolved.stationId,
      evseId: resolved.evseId,
      connectorId: resolved.connectorId,
      profileApplied: false,
    });
  } catch (error) {
    console.error('Error getting charging optimization recommendation:', error);
    res.status(502).json({ error: 'Failed to get charging recommendation' });
  }
});

/**
 * POST /api/price-optimization/optimize-charging
 * Optimize charging for a specific connector (may SetChargingProfile).
 */
router.post('/optimize-charging', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const resolved = resolveStationConnector(body.stationId, body.connectorId);
  if (!resolved.ok) {
    return res.status(resolved.status).json({ error: resolved.error });
  }

  try {
    const maxPowerWatts = resolveMaxPowerWatts(body.maxPowerWatts);
    const isCurrentlyPaused = resolvePausedFlag(body.isCurrentlyPaused);

    const result = await optimizeChargingForConnector(
      resolved.stationId,
      resolved.evseId,
      resolved.connectorId,
      maxPowerWatts,
      isCurrentlyPaused,
      { applyProfile: true }
    );

    res.json({
      ...result,
      stationId: resolved.stationId,
      evseId: resolved.evseId,
      connectorId: resolved.connectorId,
    });
  } catch (error) {
    console.error('Error optimizing charging:', error);
    res.status(502).json({ error: 'Failed to optimize charging' });
  }
});

export default router;
export {
  resolveStationConnector,
  resolveMaxPowerWatts,
  resolvePausedFlag,
  DEFAULT_MAX_POWER_WATTS,
};
