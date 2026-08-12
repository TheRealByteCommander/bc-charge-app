/**
 * Price-based charging optimization service for CitrineOS
 * 
 * This service implements time-based charging optimization by:
 * 1. Fetching day-ahead electricity prices from external APIs
 * 2. Determining optimal charging windows based on price thresholds
 * 3. Pausing or throttling charging during high-price periods
 * 4. Resuming charging during low-price periods
 */

// Default configuration
const PRICE_OPTIMIZATION_CONFIG = {
  // Price threshold in EUR/kWh above which charging should be paused
  priceThreshold: parseFloat(process.env.PRICE_THRESHOLD_EUR_PER_KWH ?? '0.35'),
  // Hysteresis to prevent frequent switching (in EUR/kWh)
  hysteresis: parseFloat(process.env.PRICE_HYSTERESIS_EUR ?? '0.02'),
  // Minimum charging power when throttling (percentage of max power)
  minChargingPowerPercent: parseInt(process.env.MIN_CHARGING_POWER_PERCENT ?? '20'),
  // API endpoint for electricity prices
  priceApiUrl: process.env.ELECTRICITY_PRICE_API_URL ?? 'https://api.energy-price-data.de/day-ahead',
  // How often to check prices (in minutes)
  priceCheckIntervalMinutes: parseInt(process.env.PRICE_CHECK_INTERVAL_MINUTES ?? '15'),
};

/**
 * Send OCPP message to CitrineOS
 * @param {string} path - API path
 * @param {string} stationId - Station identifier
 * @param {Object} body - Request body
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<any>} Response from CitrineOS
 */
async function citrineosMessage(path, stationId, body, timeoutMs = 12_000) {
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
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed?.message
        ? String(parsed.message)
        : `CitrineOS ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return parsed;
}

/**
 * Fetch day-ahead electricity prices
 * @returns {Promise<Array<{timestamp: string, price: number}>} Array of price data points
 */
async function fetchElectricityPrices() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(PRICE_OPTIMIZATION_CONFIG.priceApiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BC-Charge-Price-Optimizer/1.0'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Price API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate and normalize the price data
    if (!Array.isArray(data)) {
      throw new Error('Invalid price data format: expected array');
    }
    
    return data.map(item => ({
      timestamp: new Date(item.timestamp).toISOString(),
      price: parseFloat(item.price)
    })).filter(item => !isNaN(item.price) && item.timestamp);
    
  } catch (error) {
    console.error('Failed to fetch electricity prices:', error);
    throw new Error(`Failed to fetch electricity prices: ${error.message}`);
  }
}

/**
 * Get current electricity price based on timestamp
 * @param {Array<{timestamp: string, price: number}>} prices - Price data
 * @param {Date} timestamp - Current time
 * @returns {number|null} Current price or null if not available
 */
function getCurrentPrice(prices, timestamp) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return null;
  }
  
  // Find the price entry that matches the current time
  const now = timestamp.getTime();
  const sortedPrices = prices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  for (let i = 0; i < sortedPrices.length - 1; i++) {
    const current = new Date(sortedPrices[i].timestamp).getTime();
    const next = new Date(sortedPrices[i + 1].timestamp).getTime();
    
    if (now >= current && now < next) {
      return sortedPrices[i].price;
    }
  }
  
  // If we're past the last timestamp, use the last price
  const lastPrice = sortedPrices[sortedPrices.length - 1];
  if (now >= new Date(lastPrice.timestamp).getTime()) {
    return lastPrice.price;
  }
  
  return null;
}

/**
 * Determine if charging should be paused based on current price
 * @param {number} currentPrice - Current electricity price in EUR/kWh
 * @param {boolean} isCurrentlyPaused - Whether charging is currently paused
 * @returns {boolean} True if charging should be paused, false otherwise
 */
function shouldPauseCharging(currentPrice, isCurrentlyPaused) {
  if (currentPrice === null) {
    // If we can't determine the price, continue charging
    return false;
  }
  
  const threshold = PRICE_OPTIMIZATION_CONFIG.priceThreshold;
  const hysteresis = PRICE_OPTIMIZATION_CONFIG.hysteresis;
  
  if (isCurrentlyPaused) {
    // Use lower threshold to resume (hysteresis)
    return currentPrice > (threshold - hysteresis);
  } else {
    // Use higher threshold to pause
    return currentPrice > (threshold + hysteresis);
  }
}

/**
 * Send charging profile to pause or throttle charging
 * @param {string} stationId - OCPP station identifier
 * @param {number} evseId - EVSE identifier
 * @param {number} connectorId - Connector identifier
 * @param {number|null} targetPowerWatts - Target power in watts (null to pause)
 * @returns {Promise<boolean>} True if successful
 */
async function setChargingProfile(stationId, evseId, connectorId, targetPowerWatts) {
  try {
    // Build the charging profile based on target power
    const chargingProfile = {
      evseId: evseId,
      chargingProfile: {
        chargingProfileId: Math.floor(Date.now() / 1000), // Unique ID
        stackLevel: 1,
        chargingProfilePurpose: "TxProfile",
        chargingProfileKind: "Absolute",
        chargingSchedule: {
          startSchedule: new Date().toISOString(),
          chargingRateUnit: "W",
          chargingSchedulePeriod: [
            {
              startPeriod: 0,
              limit: targetPowerWatts !== null ? targetPowerWatts / 1000 : 0, // Convert to kW
              numberPhases: 3
            }
          ]
        }
      }
    };
    
    // Send the SetChargingProfile command to the station
    const result = await citrineosMessage(
      '/ocpp/2.0.1/smartcharging/setChargingProfile',
      stationId,
      chargingProfile,
      10000 // 10 second timeout
    );
    
    const success = Array.isArray(result) 
      ? result.some(r => r.success === true)
      : result?.success === true;
      
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
 * @returns {Promise<{shouldPause: boolean, currentPrice: number|null}>} Optimization result
 */
export async function optimizeChargingForConnector(stationId, evseId, connectorId, maxPowerWatts, isCurrentlyPaused) {
  try {
    // Fetch current electricity prices
    const prices = await fetchElectricityPrices();
    
    // Get current price
    const currentPrice = getCurrentPrice(prices, new Date());
    
    // Determine if we should pause charging
    const shouldPause = shouldPauseCharging(currentPrice, isCurrentlyPaused);
    
    // Apply the charging profile if needed
    let targetPowerWatts = null;
    if (shouldPause) {
      // Pause charging or throttle to minimum
      const minPowerPercent = PRICE_OPTIMIZATION_CONFIG.minChargingPowerPercent / 100;
      targetPowerWatts = Math.round(maxPowerWatts * minPowerPercent);
    } else {
      // Resume normal charging
      targetPowerWatts = maxPowerWatts;
    }
    
    // Only send profile if it would change the current state
    if ((shouldPause && !isCurrentlyPaused) || (!shouldPause && isCurrentlyPaused)) {
      await setChargingProfile(stationId, evseId, connectorId, targetPowerWatts);
    }
    
    return {
      shouldPause,
      currentPrice,
      targetPowerWatts
    };
  } catch (error) {
    console.error(`Failed to optimize charging for station ${stationId}:`, error);
    
    // In case of error, continue normal charging
    return {
      shouldPause: false,
      currentPrice: null,
      targetPowerWatts: maxPowerWatts
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
  Object.assign(PRICE_OPTIMIZATION_CONFIG, newConfig);
}

export default {
  optimizeChargingForConnector,
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig
};