/**
 * Frontend client for price-based charging optimization
 */

export interface ElectricityPricePoint {
  timestamp: string;
  price: number;
}

export interface PriceOptimizationConfig {
  priceThreshold: number;
  hysteresis: number;
  minChargingPowerPercent: number;
  priceApiUrl: string;
  priceCheckIntervalMinutes: number;
}

export interface ChargingOptimizationResult {
  shouldPause: boolean;
  currentPrice: number | null;
  targetPowerWatts: number | null;
}

/**
 * Fetch day-ahead electricity prices
 * @returns Promise<ElectricityPricePoint[]> Array of price data points
 */
export async function fetchElectricityPrices(): Promise<ElectricityPricePoint[]> {
  try {
    const response = await fetch('/api/citrineos/price-data', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch prices: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.prices || [];
  } catch (error) {
    console.error('Error fetching electricity prices:', error);
    throw error;
  }
}

/**
 * Get price optimization configuration
 * @returns Promise<PriceOptimizationConfig> Current configuration
 */
export async function getPriceOptimizationConfig(): Promise<PriceOptimizationConfig> {
  try {
    const response = await fetch('/api/citrineos/price-config', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching price optimization config:', error);
    // Return default config if fetch fails
    return {
      priceThreshold: 0.35,
      hysteresis: 0.02,
      minChargingPowerPercent: 20,
      priceApiUrl: 'https://api.energy-price-data.de/day-ahead',
      priceCheckIntervalMinutes: 15,
    };
  }
}

/**
 * Update price optimization configuration
 * @param config Partial<PriceOptimizationConfig> New configuration values
 * @returns Promise<boolean> True if successful
 */
export async function updatePriceOptimizationConfig(config: Partial<PriceOptimizationConfig>): Promise<boolean> {
  try {
    const response = await fetch('/api/citrineos/price-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to update config: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error updating price optimization config:', error);
    return false;
  }
}

/**
 * Get charging optimization recommendation for a connector
 * @param stationId string Station identifier
 * @param connectorId string Connector identifier
 * @returns Promise<ChargingOptimizationResult> Optimization recommendation
 */
export async function getChargingOptimizationRecommendation(
  stationId: string,
  connectorId: string
): Promise<ChargingOptimizationResult> {
  try {
    const response = await fetch(`/api/citrineos/charging-recommendation?stationId=${encodeURIComponent(stationId)}&connectorId=${encodeURIComponent(connectorId)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get recommendation: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting charging optimization recommendation:', error);
    // Default to continue charging if we can't get a recommendation
    return {
      shouldPause: false,
      currentPrice: null,
      targetPowerWatts: null,
    };
  }
}

export default {
  fetchElectricityPrices,
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig,
  getChargingOptimizationRecommendation,
};