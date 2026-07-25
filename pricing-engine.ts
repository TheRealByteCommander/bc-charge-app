/**
 * BC Charge Pricing Engine
 * Core logic for calculating charging sessions, including time-based tariffs
 * and block-fees (Idle-Time).
 * 
 * This module ensures mathematical precision for billing and financial settlement.
 */

export interface ChargingTariff {
  id: string;
  name: string;
  energyPricePerKwh: number; // Net price in EUR
  sessionFee: number;        // Fixed fee per session in EUR
  blockFeePerMinute: number;  // Fee after charging ends and vehicle remains plugged in
  gracePeriodMinutes: number; // Minutes before block-fee starts
}

export interface SessionCalculation {
  grossTotal: number;
  netTotal: number;
  energyCost: number;
  sessionFeeCost: number;
  blockFeeCost: number;
  totalKwh: number;
  chargingDurationMinutes: number;
  blockingDurationMinutes: number;
}

export class PricingEngine {
  private readonly VAT_RATE = 0.19; // Standard German VAT 19%

  /**
   * Calculates the total cost for a charging session.
   * @param tariff The active tariff for the session
   * @param consumedKwh Total energy delivered in kWh
   * @param chargingMinutes Duration of actual energy transfer in minutes
   * @param blockingMinutes Duration after charging finished but still connected
   */
  public calculateSession(
    tariff: ChargingTariff,
    consumedKwh: number,
    chargingMinutes: number,
    blockingMinutes: number
  ): SessionCalculation {
    // 1. Energy cost calculation
    const energyCost = this.round(consumedKwh * tariff.energyPricePerKwh);

    // 2. Block-fee calculation
    // Only applies if blockingMinutes exceeds the grace period
    const effectiveBlockingTime = Math.max(0, blockingMinutes - tariff.gracePeriodMinutes);
    const blockFeeCost = this.round(effectiveBlockingTime * tariff.blockFeePerMinute);

    // 3. Net total (Sum of all costs without VAT)
    const netTotal = this.round(energyCost + tariff.sessionFee + blockFeeCost);

    // 4. Gross total (Including VAT)
    const grossTotal = this.round(netTotal * (1 + this.VAT_RATE));

    return {
      grossTotal,
      netTotal,
      energyCost,
      sessionFeeCost: tariff.sessionFee,
      blockFeeCost,
      totalKwh: consumedKwh,
      chargingDurationMinutes: chargingMinutes,
      blockingDurationMinutes: blockingMinutes,
    };
  }

  private round(value: number): number {
    // Precision to 4 decimal places for intermediate calculations, 
    // final results would be rounded to 2 for payment.
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }
}

// --- Simple Test Suite for Validation (Ruby's Check) ---
const testTariff: ChargingTariff = {
  id: 'standard-1',
  name: 'Standard Tarif',
  energyPricePerKwh: 0.50,
  sessionFee: 0.50,
  blockFeePerMinute: 0.10,
  gracePeriodMinutes: 15,
};

const engine = new PricingEngine();
const result = engine.calculateSession(testTariff, 20, 60, 30);
console.log('Calculation Result:', result);
// Expected: 
// Energy: 20 * 0.5 = 10.00
// Session: 0.50
// Block: (30 - 15) * 0.1 = 1.50
// Net: 12.00
// Gross: 12 * 1.19 = 14.28
