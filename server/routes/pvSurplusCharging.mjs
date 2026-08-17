/**
 * PV Surplus Charging routes
 * Mount: /api/pv-surplus
 */

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.mjs';
import {
  getCurrentPvSurplus,
  optimizeChargingWithPvSurplus,
  reportPvSurplus,
} from '../services/pvSurplusCharging.mjs';
import logger from '../utils/logger.mjs';

const router = Router();

/**
 * POST /api/pv-surplus
 * External EMS reports current solar surplus (kW).
 * Body: { surplus: number, apply?: boolean }
 * Default apply=true → forward to LM or local optimize.
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { surplus, apply } = req.body ?? {};

    if (surplus === undefined || surplus === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: surplus',
      });
    }

    const n = typeof surplus === 'number' ? surplus : Number(surplus);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid surplus value. Must be a non-negative number.',
      });
    }

    const shouldApply = apply === undefined ? true : Boolean(apply);
    const result = await reportPvSurplus(n, { apply: shouldApply });

    res.status(200).json({
      success: true,
      message: shouldApply
        ? 'PV surplus updated and applied'
        : 'PV surplus updated successfully',
      data: {
        surplus: result.data.surplus,
        updateTime: result.data.updateTime,
        applied: result.applied,
        mode: result.mode ?? null,
      },
      optimize: result.optimize ?? null,
    });
  } catch (error) {
    const status = error?.status && Number.isFinite(error.status) ? error.status : 500;
    logger.error('Error updating PV surplus', {
      message: error instanceof Error ? error.message : String(error),
    });
    res.status(status).json({
      success: false,
      message: `Failed to update PV surplus: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

/**
 * GET /api/pv-surplus
 */
router.get('/', optionalAuth, (_req, res) => {
  try {
    const currentSurplus = getCurrentPvSurplus();
    res.status(200).json({
      success: true,
      data: {
        surplus: currentSurplus.surplus,
        updateTime: currentSurplus.updateTime,
      },
    });
  } catch (error) {
    logger.error('Error getting PV surplus', {
      message: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: `Failed to get PV surplus: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

/**
 * POST /api/pv-surplus/optimize-charging
 * Admin-only re-apply of current surplus budget.
 */
router.post('/optimize-charging', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const bodySurplus = req.body?.surplus;
    const surplus =
      bodySurplus !== undefined && bodySurplus !== null
        ? Number(bodySurplus)
        : undefined;

    const result = await optimizeChargingWithPvSurplus(
      Number.isFinite(surplus) && surplus >= 0 ? { surplus } : {}
    );

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    logger.error('Error optimizing charging with PV surplus', {
      message: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: `Failed to optimize charging with PV surplus: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
});

export default router;
