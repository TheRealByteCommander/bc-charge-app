/**
 * BC Charge Idle Timer Service
 * 
 * Responsibility: Monitors charging sessions to detect when energy transfer has stopped
 * but the vehicle remains connected. After a predefined grace period, it triggers 
 * the billing system to start applying block-fees.
 */

import { PricingEngine, ChargingTariff } from './pricing-engine';

export interface ChargingSessionState {
  sessionId: string;
  chargerId: string;
  status: 'CHARGING' | 'FINISHED' | 'DISCONNECTED';
  lastEnergyTransferTimestamp: number; // Epoch ms
  connectionTimestamp: number; // Epoch ms
}

export class IdleTimerService {
  private activeSessions: Map<string, ChargingSessionState> = new Map();
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

  constructor(private pricingEngine: PricingEngine) {}

  /**
   * Updates the session state based on OCPP heartbeats or MeterValues.
   */
  public updateSessionState(state: ChargingSessionState): void {
    this.activeSessions.set(state.sessionId, state);
  }

  /**
   * Evaluates all active sessions to determine if block-fees should be triggered.
   * This is intended to be called by a cron job or a background loop.
   */
  public evaluateIdleSessions(tariff: ChargingTariff): void {
    const now = Date.now();

    this.activeSessions.forEach((state, sessionId) => {
      if (state.status === 'FINISHED') {
        const idleDurationMs = now - state.lastEnergyTransferTimestamp;
        const idleMinutes = Math.floor(idleDurationMs / 60000);

        if (idleMinutes > tariff.gracePeriodMinutes) {
          this.triggerBlockFee(sessionId, idleMinutes, tariff);
        }
      }
    });
  }

  private triggerBlockFee(sessionId: string, totalIdleMinutes: number, tariff: ChargingTariff): void {
    // Calculate the specific block-fee portion for the current interval
    const blockFee = (totalIdleMinutes - tariff.gracePeriodMinutes) * tariff.blockFeePerMinute;
    
    console.log(`[BILLING-EVENT] Session ${sessionId}: Vehicle is idle for ${totalIdleMinutes} mins.`);
    console.log(`Triggering block-fee: ${blockFee.toFixed(4)} EUR`);
    
    // Integration point for billing-audit-logger.ts
    this.logToAuditTrail(sessionId, 'BLOCK_FEE_TRIGGER', blockFee);
  }

  private logToAuditTrail(sessionId: string, event: string, amount: number): void {
    // Placeholder for BillingAuditLogger integration
    console.log(`Audit Log: ${sessionId} | ${event} | ${amount}`);
  }

  public clearSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }
}

// --- Validation Block (Ruby's Logic) ---
const mockPricing = new PricingEngine();
const idleService = new IdleTimerService(mockPricing);

const mockTariff = {
  id: 'std-1',
  name: 'Standard',
  energyPricePerKwh: 0.5,
  sessionFee: 0.5,
  blockFeePerMinute: 0.1,
  gracePeriodMinutes: 15,
};

// Case: Finished charging 30 minutes ago (15 min grace + 15 min fee)
const sessionState: ChargingSessionState = {
  sessionId: 'sess-123',
  chargerId: 'cp-001',
  status: 'FINISHED',
  lastEnergyTransferTimestamp: Date.now() - (30 * 60 * 1000),
  connectionTimestamp: Date.now() - (60 * 60 * 1000),
};

idleService.updateSessionState(sessionState);
idleService.evaluateIdleSessions(mockTariff);
// Expected Output: Block-fee for 15 minutes -> 1.50 EUR
