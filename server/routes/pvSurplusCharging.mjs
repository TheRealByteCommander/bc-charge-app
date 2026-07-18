/**
 * PV Surplus Charging routes for CitrineOS
 */

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.mjs';
import { updatePvSurplus, getCurrentPvSurplus, optimizeChargingWithPvSurplus } from '../services/pvSurplusCharging.mjs';

const router = Router();

/**
 * POST /api/pv-surplus
 * Endpoint for external energy management systems to report current solar surplus
 * 
 * Request body:
 * {
 *   "surplus": 15.5  // Current PV surplus in kW
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "PV surplus updated successfully",
 *   "data": {
 *     "surplus": 15.5,
 *     "updateTime": "2023-07-14T10:30:00.000Z"
 *   }
 * }
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { surplus } = req.body;

    // Validate input
    if (surplus === undefined || surplus === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: surplus',
      });
    }

    if (typeof surplus !== 'number' || surplus < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid surplus value. Must be a non-negative number.',
      });
    }

    // Update the surplus value
    updatePvSurplus(surplus);

    // Get current surplus data
    const currentSurplus = getCurrentPvSurplus();

    // Return success response
    res.status(200).json({
      success: true,
      message: 'PV surplus updated successfully',
      data: {
        surplus: currentSurplus.surplus,
        updateTime: currentSurplus.updateTime
      },
    });
  } catch (error) {
    console.error('Error updating PV surplus:', error);
    res.status(500).json({
      success: false,
      message: `Failed to update PV surplus: ${error.message}`,
    });
  }
});

/**
 * GET /api/pv-surplus
 * Endpoint to get current PV surplus value
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "surplus": 15.5,
 *     "updateTime": "2023-07-14T10:30:00.000Z"
 *   }
 * }
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const currentSurplus = getCurrentPvSurplus();

    res.status(200).json({
      success: true,
      data: {
        surplus: currentSurplus.surplus,
        updateTime: currentSurplus.updateTime
      },
    });
  } catch (error) {
    console.error('Error getting PV surplus:', error);
    res.status(500).json({
      success: false,
      message: `Failed to get PV surplus: ${error.message}`,
    });
  }
});

/**
 * POST /api/pv-surplus/optimize-charging
 * Optimize charging based on current PV surplus
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Distributed 15.5 kW of PV surplus among 2 active sessions",
 *   "surplus": 15.5,
 *   "sessionsAffected": 2
 * }
 */
router.post('/optimize-charging', requireAuth, async (req, res) => {
  try {
    // Only admins should be able to trigger optimization manually
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    // Optimize charging based on current PV surplus
    const result = await optimizeChargingWithPvSurplus();

    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error('Error optimizing charging with PV surplus:', error);
    res.status(500).json({
      success: false,
      message: `Failed to optimize charging with PV surplus: ${error.message}`,
    });
  }
});

export default router;