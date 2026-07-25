/**
 * BC Charge Revenue Share Manager
 * 
 * Responsibility: Handles the distribution of charging revenue between BC Charge 
 * and the Site Partner (Landlord/Operator). 
 * 
 * It calculates the split based on a predefined agreement, ensuring that 
 * energy costs are deducted first (cost-plus model) before the margin is shared.
 */

import { SessionCalculation } from './pricing-engine';

export interface RevenueShareAgreement {
  partnerId: string;
  siteId: string;
  energyCostPassThrough: boolean; // If true, energy cost is deducted before split
  partnerMarginPercentage: number; // e.g. 0.30 for 30% of the margin
  bcChargeMarginPercentage: number; // e.g. 0.70 for 70% of the margin
}

export interface DistributionResult {
  grossRevenue: number;
  totalEnergyCost: number;
  shareableMargin: number;
  partnerPayout: number;
  bcChargePayout: number;
  vatAmount: number;
}

export class RevenueShareManager {
  private readonly VAT_RATE = 0.19;

  /**
   * Distributes the revenue of a session according to the site agreement.
   * @param calculation The final session calculation from the PricingEngine
   * @param agreement The specific revenue share agreement for the site
   * @param actualEnergyCost The real cost of energy purchased from the grid (B2B cost)
   */
  public calculateSplit(
    calculation: SessionCalculation,
    agreement: RevenueShareAgreement,
    actualEnergyCost: number
  ): DistributionResult {
    const grossRevenue = calculation.grossTotal;
    const netRevenue = calculation.netTotal;

    // 1. Calculate the "Shareable Margin"
    // In a standard CPO model, the energy cost is a pass-through.
    // Margin = Net Revenue - Actual Energy Cost
    const shareableMargin = netRevenue - actualEnergyCost;

    if (shareableMargin < 0) {
      // Handle case where energy cost exceeds revenue (loss)
      // In reality, this would trigger a deficit alert.
      console.warn(`[FINANCIAL-ALERT] Session generates a loss of ${shareableMargin} EUR`);
    }

    // 2. Apply the split percentages to the margin
    const partnerPayout = this.round(shareableMargin * agreement.partnerMarginPercentage);
    const bcChargePayout = this.round(shareableMargin * agreement.bcChargeMarginPercentage);
    const vatAmount = grossRevenue - netRevenue;

    return {
      grossRevenue,
      totalEnergyCost: actualEnergyCost,
      shareableMargin,
      partnerPayout,
      bcChargePayout,
      vatAmount,
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

// --- Validation Block (Ruby's Logic) ---
const revManager = new RevenueShareManager();
const mockAgreement: RevenueShareAgreement = {
  partnerId: 'partner-abc',
  siteId: 'site-123',
  energyCostPassThrough: true,
  partnerMarginPercentage: 0.30, // 30% to partner
  bcChargeMarginPercentage: 0.70, // 70% to BC Charge
};

// Scenario:
// Net Revenue: 12.00 EUR
// Actual Energy Cost from Grid: 8.00 EUR
// Shareable Margin: 4.00 EUR
// Partner: 4 * 0.3 = 1.20 EUR
// BC Charge: 4 * 0.7 = 2.80 EUR

const mockCalculation: SessionCalculation = {
  grossTotal: 14.28,
  netTotal: 12.00,
  energyCost: 10.00, // This is what the user paid, not the B2B cost
  sessionFeeCost: 0.50,
  blockFeeCost: 1.50,
  totalKwh: 20,
  chargingDurationMinutes: 60,
  blockingDurationMinutes: 30,
};

const result = revManager.calculateSplit(mockCalculation, mockAgreement, 8.00);
console.log('Distribution Result:', result);
