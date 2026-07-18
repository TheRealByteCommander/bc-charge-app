import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig,
} from './priceOptimizer.mjs';

describe('priceOptimizer', () => {
  beforeEach(() => {
    updatePriceOptimizationConfig({
      priceThreshold: 0.35,
      hysteresis: 0.02,
      minChargingPowerPercent: 20,
      priceApiUrl: 'https://api.energy-price-data.de/day-ahead',
      priceCheckIntervalMinutes: 15,
    });
  });

  it('liefert Standard-Konfiguration', () => {
    const config = getPriceOptimizationConfig();
    expect(config.priceThreshold).toBe(0.35);
    expect(config.hysteresis).toBe(0.02);
    expect(config.minChargingPowerPercent).toBe(20);
  });

  it('aktualisiert Konfigurationswerte', () => {
    updatePriceOptimizationConfig({ priceThreshold: 0.4 });
    expect(getPriceOptimizationConfig().priceThreshold).toBe(0.4);
  });
});
