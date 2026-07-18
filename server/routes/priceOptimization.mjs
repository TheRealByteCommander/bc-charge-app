/**
 * Price-based charging optimization routes for CitrineOS
 */

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.mjs';
import { optimizeChargingForConnector, getPriceOptimizationConfig, updatePriceOptimizationConfig } from '../services/priceOptimization/priceOptimizer.mjs';

const router = Router();

// Mock function to fetch electricity prices - in a real implementation,
// this would connect to an actual electricity price API
async function fetchElectricityPrices() {
  // This is a mock implementation - in production, connect to a real API
  // like Entsoe-E or a local energy provider API
  
  const now = new Date();
  const prices = [];
  
  // Generate 24 hours of mock price data
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now);
    hour.setHours(now.getHours() + i);
    
    // Simple pricing model: higher prices during day, lower at night
    let price;
    const hourOfDay = hour.getHours();
    if (hourOfDay >= 7 && hourOfDay <= 20) {
      // Daytime prices (higher)
      price = 0.30 + Math.random() * 0.20; // 0.30 - 0.50 EUR/kWh
    } else {
      // Nighttime prices (lower)
      price = 0.20 + Math.random() * 0.15; // 0.20 - 0.35 EUR/kWh
    }
    
    prices.push({
      timestamp: hour.toISOString(),
      price: parseFloat(price.toFixed(4))
    });
  }
  
  return prices;
}

/**
 * GET /api/price-optimization/price-data
 * Fetch day-ahead electricity prices
 */
router.get('/price-data', optionalAuth, async (_req, res) => {
  try {
    const prices = await fetchElectricityPrices();
    res.json({ prices });
  } catch (error) {
    console.error('Error fetching electricity prices:', error);
    res.status(502).json({ error: 'Failed to fetch electricity prices' });
  }
});

/**
 * GET /api/price-optimization/config
 * Get price optimization configuration
 */
router.get('/config', requireAuth, (req, res) => {
  try {
    // Only admins should be able to get the full config
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
    // Only admins should be able to update the config
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const newConfig = req.body;
    updatePriceOptimizationConfig(newConfig);
    
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating price optimization config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * GET /api/price-optimization/charging-recommendation
 * Get charging optimization recommendation for a connector
 */
router.get('/charging-recommendation', optionalAuth, async (req, res) => {
  const { stationId, connectorId } = req.query;
  
  if (!stationId || !connectorId) {
    return res.status(400).json({ error: 'stationId and connectorId are required' });
  }
  
  try {
    // For this example, we'll use mock values
    // In a real implementation, you would fetch the actual station data
    const evseId = 1;
    const maxPowerWatts = 22000; // Default to 22kW
    const isCurrentlyPaused = false;
    
    // Get the optimization recommendation
    const result = await optimizeChargingForConnector(
      stationId,
      evseId,
      parseInt(connectorId.split('-')[3]), // Extract connector ID from "evse-X-conn-Y"
      maxPowerWatts,
      isCurrentlyPaused
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error getting charging optimization recommendation:', error);
    res.status(502).json({ error: 'Failed to get charging recommendation' });
  }
});

/**
 * POST /api/price-optimization/optimize-charging
 * Optimize charging for a specific connector
 */
router.post('/optimize-charging', requireAuth, async (req, res) => {
  const { stationId, connectorId, isCurrentlyPaused } = req.body;
  
  if (!stationId || !connectorId) {
    return res.status(400).json({ error: 'stationId and connectorId are required' });
  }
  
  try {
    // For this example, we'll use mock values
    // In a real implementation, you would fetch the actual station data
    const evseId = 1;
    const maxPowerWatts = 22000; // Default to 22kW
    
    // Get the optimization result
    const result = await optimizeChargingForConnector(
      stationId,
      evseId,
      parseInt(connectorId.split('-')[3]), // Extract connector ID from "evse-X-conn-Y"
      maxPowerWatts,
      Boolean(isCurrentlyPaused)
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error optimizing charging:', error);
    res.status(502).json({ error: 'Failed to optimize charging' });
  }
});

export default router;