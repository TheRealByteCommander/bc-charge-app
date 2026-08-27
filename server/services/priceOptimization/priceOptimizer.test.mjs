import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPriceOptimizationConfig,
  updatePriceOptimizationConfig,
  sanitizePriceOptimizationConfigUpdate,
  normalizeElectricityPriceData,
  buildPriceChargingProfile,
  getCurrentPrice,
  shouldPauseCharging,
  setChargingProfile,
  computeChargingRecommendation,
  optimizeChargingForConnector,
  setPriceOptimizerTestDeps,
} from './priceOptimizer.mjs';

describe('priceOptimizer', () => {
  beforeEach(() => {
    setPriceOptimizerTestDeps({});
    updatePriceOptimizationConfig({
      priceThreshold: 0.35,
      hysteresis: 0.02,
      minChargingPowerPercent: 20,
      priceApiUrl: 'https://api.energy-price-data.de/day-ahead',
      priceCheckIntervalMinutes: 15,
    });
  });

  afterEach(() => {
    setPriceOptimizerTestDeps({});
  });

  it('liefert Standard-Konfiguration', () => {
    const config = getPriceOptimizationConfig();
    expect(config.priceThreshold).toBe(0.35);
    expect(config.hysteresis).toBe(0.02);
    expect(config.minChargingPowerPercent).toBe(20);
  });

  it('aktualisiert Konfigurationswerte (nur bekannte Keys, validiert)', () => {
    updatePriceOptimizationConfig({ priceThreshold: 0.4, __proto__: { x: 1 }, evil: 'nope' });
    expect(getPriceOptimizationConfig().priceThreshold).toBe(0.4);
    expect(getPriceOptimizationConfig()).not.toHaveProperty('evil');

    // Out-of-range / non-http rejected
    expect(sanitizePriceOptimizationConfigUpdate({ priceThreshold: -1 })).toEqual({});
    expect(sanitizePriceOptimizationConfigUpdate({ priceApiUrl: 'javascript:alert(1)' })).toEqual(
      {}
    );
    expect(
      sanitizePriceOptimizationConfigUpdate({
        minChargingPowerPercent: 150,
        priceCheckIntervalMinutes: 0,
      })
    ).toEqual({});
  });

  describe('normalizeElectricityPriceData', () => {
    it('parst bare arrays und droppt corrupt rows', () => {
      const prices = normalizeElectricityPriceData([
        { timestamp: '2026-08-27T10:00:00.000Z', price: 0.22 },
        { timestamp: 'bad', price: 0.3 },
        { timestamp: '2026-08-27T11:00:00.000Z', price: 'nope' },
        null,
        { time: '2026-08-27T12:00:00Z', value: '0.18' },
      ]);
      expect(prices).toEqual([
        { timestamp: '2026-08-27T10:00:00.000Z', price: 0.22 },
        { timestamp: '2026-08-27T12:00:00.000Z', price: 0.18 },
      ]);
    });

    it('akzeptiert envelope { prices|data }', () => {
      expect(
        normalizeElectricityPriceData({
          prices: [{ timestamp: '2026-08-27T08:00:00.000Z', price: 0.11 }],
        })
      ).toHaveLength(1);
      expect(
        normalizeElectricityPriceData({
          data: [{ starts_at: '2026-08-27T09:00:00.000Z', eur_per_kwh: 0.25 }],
        })
      ).toEqual([{ timestamp: '2026-08-27T09:00:00.000Z', price: 0.25 }]);
    });

    it('gibt [] bei Müll zurück', () => {
      expect(normalizeElectricityPriceData(null)).toEqual([]);
      expect(normalizeElectricityPriceData({ foo: 1 })).toEqual([]);
      expect(normalizeElectricityPriceData('x')).toEqual([]);
    });
  });

  describe('buildPriceChargingProfile', () => {
    it('setzt limit in Watts bei chargingRateUnit W (kein kW-Leak)', () => {
      const body = buildPriceChargingProfile({
        evseId: 1,
        targetPowerWatts: 22000,
        chargingProfileId: 42,
        startSchedule: '2026-08-27T08:00:00.000Z',
      });

      expect(body.evseId).toBe(1);
      expect(body.chargingProfile.chargingProfilePurpose).toBe('TxProfile');
      expect(body.chargingProfile.chargingProfileKind).toBe('Absolute');
      expect(body.chargingProfile.chargingProfileId).toBe(42);
      expect(body.chargingProfile.chargingSchedule).toMatchObject({
        startSchedule: '2026-08-27T08:00:00.000Z',
        chargingRateUnit: 'W',
      });
      expect(body.chargingProfile.chargingSchedule.chargingSchedulePeriod).toEqual([
        { startPeriod: 0, limit: 22000, numberPhases: 3 },
      ]);
      // Regression: former bug sent limit = watts/1000 while unit stayed "W"
      expect(body.chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit).not.toBe(22);
    });

    it('null target → 0 W pause; negative clamped; invalid evse → 0', () => {
      const paused = buildPriceChargingProfile({ targetPowerWatts: null, evseId: -1 });
      expect(paused.evseId).toBe(0);
      expect(paused.chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit).toBe(0);

      const neg = buildPriceChargingProfile({ targetPowerWatts: -500, evseId: 2 });
      expect(neg.evseId).toBe(2);
      expect(neg.chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit).toBe(0);
    });
  });

  describe('getCurrentPrice / shouldPauseCharging', () => {
    const series = [
      { timestamp: '2026-08-27T10:00:00.000Z', price: 0.2 },
      { timestamp: '2026-08-27T11:00:00.000Z', price: 0.4 },
      { timestamp: '2026-08-27T12:00:00.000Z', price: 0.3 },
    ];

    it('wählt Slot ohne Caller-Array zu mutieren', () => {
      const copy = series.map((p) => ({ ...p }));
      const price = getCurrentPrice(copy, new Date('2026-08-27T11:30:00.000Z'));
      expect(price).toBe(0.4);
      expect(copy.map((p) => p.timestamp)).toEqual(series.map((p) => p.timestamp));
    });

    it('hysteresis pause/resume', () => {
      expect(shouldPauseCharging(0.38, false)).toBe(true); // > 0.37
      expect(shouldPauseCharging(0.36, false)).toBe(false);
      expect(shouldPauseCharging(0.34, true)).toBe(true); // still > 0.33
      expect(shouldPauseCharging(0.32, true)).toBe(false);
      expect(shouldPauseCharging(null, false)).toBe(false);
    });
  });

  describe('setChargingProfile', () => {
    it('posted body uses Watt limits and accepts remote confirmation', async () => {
      /** @type {unknown} */
      let posted = null;
      setPriceOptimizerTestDeps({
        citrineosPost: async (_path, stationId, body) => {
          expect(stationId).toBe('CS-1');
          posted = body;
          return [{ success: true, status: 'Accepted' }];
        },
      });

      const ok = await setChargingProfile('CS-1', 1, 2, 11000);
      expect(ok).toBe(true);
      expect(posted).toMatchObject({
        evseId: 1,
        chargingProfile: {
          chargingSchedule: {
            chargingRateUnit: 'W',
            chargingSchedulePeriod: [{ startPeriod: 0, limit: 11000, numberPhases: 3 }],
          },
        },
      });
    });

    it('rejected confirmation → false', async () => {
      setPriceOptimizerTestDeps({
        citrineosPost: async () => ({ success: false, status: 'Rejected' }),
      });
      expect(await setChargingProfile('CS-1', 0, 0, 5000)).toBe(false);
    });
  });

  describe('computeChargingRecommendation (read-only)', () => {
    it('throttles on high price without posting SetChargingProfile', async () => {
      const posts = [];
      setPriceOptimizerTestDeps({
        fetchPrices: async () => [
          { timestamp: '2026-08-27T00:00:00.000Z', price: 0.5 },
          { timestamp: '2026-08-28T00:00:00.000Z', price: 0.5 },
        ],
        citrineosPost: async (_p, _s, body) => {
          posts.push(body);
          return { status: 'Accepted' };
        },
      });

      const result = await computeChargingRecommendation(22000, false);
      expect(result.shouldPause).toBe(true);
      expect(result.currentPrice).toBe(0.5);
      expect(result.targetPowerWatts).toBe(4400);
      expect(posts).toHaveLength(0);
    });
  });

  describe('optimizeChargingForConnector', () => {
    it('throttles on high price and sends profile only on state change', async () => {
      const posts = [];
      setPriceOptimizerTestDeps({
        fetchPrices: async () => [
          { timestamp: '2026-08-27T00:00:00.000Z', price: 0.5 },
          { timestamp: '2026-08-28T00:00:00.000Z', price: 0.5 },
        ],
        citrineosPost: async (_p, _s, body) => {
          posts.push(body);
          return { status: 'Accepted' };
        },
      });

      const result = await optimizeChargingForConnector('CS-X', 1, 1, 22000, false);
      expect(result.shouldPause).toBe(true);
      expect(result.currentPrice).toBe(0.5);
      expect(result.targetPowerWatts).toBe(4400); // 20% of 22 kW
      expect(result.profileApplied).toBe(true);
      expect(posts).toHaveLength(1);
      expect(
        posts[0].chargingProfile.chargingSchedule.chargingSchedulePeriod[0].limit
      ).toBe(4400);

      // Already paused → no second profile post
      posts.length = 0;
      const again = await optimizeChargingForConnector('CS-X', 1, 1, 22000, true);
      expect(again.shouldPause).toBe(true);
      expect(again.profileApplied).toBe(false);
      expect(posts).toHaveLength(0);

      // applyProfile:false never posts even on state change
      posts.length = 0;
      const dry = await optimizeChargingForConnector('CS-X', 1, 1, 22000, false, {
        applyProfile: false,
      });
      expect(dry.shouldPause).toBe(true);
      expect(dry.profileApplied).toBe(false);
      expect(posts).toHaveLength(0);
    });

    it('price fetch failure → continue charging, no throw', async () => {
      setPriceOptimizerTestDeps({
        fetchPrices: async () => {
          throw new Error('network down');
        },
        citrineosPost: async () => {
          throw new Error('should not call');
        },
      });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await optimizeChargingForConnector('CS-Y', 0, 0, 22000, false);
      spy.mockRestore();
      expect(result).toEqual({
        shouldPause: false,
        currentPrice: null,
        targetPowerWatts: 22000,
        profileApplied: false,
      });
    });
  });
});
