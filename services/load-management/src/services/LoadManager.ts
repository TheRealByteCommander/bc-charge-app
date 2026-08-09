import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

/**
 * LoadManager Service for Dynamic Load Management
 * 
 * This service monitors charging stations and dynamically adjusts 
 * charging profiles based on aggregated power consumption to prevent
 * grid overload and optimize energy costs.
 */

interface ChargingStation {
  id: string;
  currentPower: number; // in kW
  maxPower: number;     // in kW
  isActive: boolean;
  lastUpdate: Date;
}

interface LoadManagementConfig {
  maxSitePower: number;        // Maximum power allowed for the site (kW)
  adjustmentThreshold: number; // Threshold to trigger adjustment (kW)
  adjustmentDelay: number;     // Delay before adjustment (ms)
  monitoringInterval: number;  // How often to check loads (ms)
}

export class LoadManager extends EventEmitter {
  private stations: Map<string, ChargingStation> = new Map();
  private config: LoadManagementConfig;
  private citrineWs: WebSocket;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private adjustmentTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private readonly wsUrl: string;
  private readonly defaultMaxPowerKw: number;

  constructor(config: LoadManagementConfig, citrineWsUrl: string, defaultMaxPowerKw = 22) {
    super();
    this.config = config;
    this.wsUrl = citrineWsUrl;
    this.defaultMaxPowerKw = defaultMaxPowerKw;
    this.citrineWs = this.createSocket();
  }

  public getDefaultMaxPower(): number {
    return this.defaultMaxPowerKw;
  }

  public getStationIds(): string[] {
    return Array.from(this.stations.keys());
  }

  public getStationSnapshot(stationId: string): ChargingStation | undefined {
    const station = this.stations.get(stationId);
    return station ? { ...station } : undefined;
  }

  public getStations(): ChargingStation[] {
    return Array.from(this.stations.values()).map((s) => ({ ...s }));
  }

  public isWebSocketOpen(): boolean {
    return this.citrineWs.readyState === WebSocket.OPEN;
  }

  /**
   * Initialize the LoadManager service
   */
  public async initialize(): Promise<void> {
    console.log('Initializing LoadManager service...');
    
    // Start monitoring stations
    this.startMonitoring();
    
    console.log('LoadManager service initialized successfully');
  }

  /**
   * Register a charging station with the LoadManager
   */
  public registerStation(stationId: string, maxPower: number): void {
    const existing = this.stations.get(stationId);
    if (!existing) {
      this.stations.set(stationId, {
        id: stationId,
        currentPower: 0,
        maxPower: maxPower,
        isActive: false,
        lastUpdate: new Date()
      });
      console.log(`Registered charging station ${stationId} with max power ${maxPower}kW`);
      return;
    }
    // Allow updating maxPower for already known stations (e.g. PV surplus rebalance)
    existing.maxPower = maxPower;
    existing.lastUpdate = new Date();
  }

  /**
   * Apply a station-wide charging power limit (kW) via SetChargingProfile.
   */
  public setStationChargingLimit(stationId: string, maxPowerKw: number): boolean {
    if (!Number.isFinite(maxPowerKw) || maxPowerKw < 0) {
      throw new Error('maxPowerKw must be a non-negative number');
    }
    if (!this.stations.has(stationId)) {
      // Register with at least the requested limit as initial ceiling
      this.registerStation(stationId, Math.max(maxPowerKw, this.defaultMaxPowerKw));
    }
    const station = this.stations.get(stationId)!;
    // Operational limit must not exceed hardware/config ceiling
    const clamped = Math.max(0, Math.min(maxPowerKw, station.maxPower || maxPowerKw));
    this.sendSetChargingProfile(stationId, clamped);
    return this.isWebSocketOpen();
  }

  /**
   * Distribute available site headroom (e.g. PV surplus) across active stations.
   */
  public applySurplusBudget(surplusKw: number, minPerStationKw = 1.4): void {
    const active = Array.from(this.stations.values()).filter((s) => s.isActive);
    if (active.length === 0) {
      return;
    }
    const budget = Math.max(0, surplusKw);
    const share = budget / active.length;
    for (const station of active) {
      const target = Math.min(station.maxPower, Math.max(minPerStationKw, share));
      this.sendSetChargingProfile(station.id, target);
      console.log(
        `PV surplus budget: station ${station.id} limited to ${target.toFixed(2)}kW (share ${share.toFixed(2)}kW)`
      );
    }
  }

  /**
   * Update the power consumption for a charging station
   */
  public updateStationPower(stationId: string, power: number): void {
    const station = this.stations.get(stationId);
    if (station) {
      station.currentPower = power;
      station.lastUpdate = new Date();
      station.isActive = power > 0;
      console.log(`Updated station ${stationId} power to ${power}kW`);
      
      // Check if we need to adjust loads
      this.checkLoadAdjustment();
    }
  }

  /**
   * Remove a charging station from monitoring
   */
  public removeStation(stationId: string): void {
    if (this.stations.has(stationId)) {
      this.stations.delete(stationId);
      console.log(`Removed charging station ${stationId} from monitoring`);
    }
  }

  /**
   * Start monitoring stations for load management
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    this.monitoringTimer = setInterval(() => {
      this.checkStaleConnections();
    }, this.config.monitoringInterval);
  }

  /**
   * Check for stale connections and clean them up
   */
  private checkStaleConnections(): void {
    const now = new Date();
    for (const [stationId, station] of this.stations.entries()) {
      const timeDiff = now.getTime() - station.lastUpdate.getTime();
      // If no update for more than 2 monitoring intervals, mark as inactive
      if (timeDiff > this.config.monitoringInterval * 2) {
        station.isActive = false;
        station.currentPower = 0;
        console.log(`Marked station ${stationId} as inactive due to stale connection`);
      }
    }
  }

  /**
   * Check if load adjustment is needed and perform it
   */
  private checkLoadAdjustment(): void {
    const totalPower = this.calculateTotalPower();
    console.log(`Current total power consumption: ${totalPower}kW`);

    if (totalPower > this.config.maxSitePower - this.config.adjustmentThreshold) {
      console.log(
        `Load approaching limit (${this.config.maxSitePower}kW). Adjusting charging profiles...`
      );
      // Debounce: only one pending adjustment; always re-read live totals when it fires
      if (this.adjustmentTimer) {
        clearTimeout(this.adjustmentTimer);
      }
      this.adjustmentTimer = setTimeout(() => {
        this.adjustmentTimer = null;
        this.adjustChargingProfiles(this.calculateTotalPower());
      }, this.config.adjustmentDelay);
    }
  }

  /**
   * Calculate the total power consumption across all active stations
   */
  private calculateTotalPower(): number {
    let total = 0;
    for (const station of this.stations.values()) {
      if (station.isActive) {
        total += station.currentPower;
      }
    }
    return total;
  }

  /**
   * Adjust charging profiles based on current load
   */
  private adjustChargingProfiles(currentTotalPower: number): void {
    // Only adjust if we're still over the threshold (live total)
    if (currentTotalPower <= this.config.maxSitePower - this.config.adjustmentThreshold) {
      return;
    }

    const activeStations = Array.from(this.stations.values()).filter((s) => s.isActive);
    if (activeStations.length === 0) return;

    const targetTotal = Math.max(0, this.config.maxSitePower - this.config.adjustmentThreshold);
    const scale = currentTotalPower > 0 ? targetTotal / currentTotalPower : 0;

    console.log(
      `Adjusting ${activeStations.length} active stations, scale=${scale.toFixed(3)} (total ${currentTotalPower.toFixed(2)}kW → ${targetTotal.toFixed(2)}kW)`
    );

    // Proportional reduction preserves relative share; floor at 1.4 kW when possible
    for (const station of activeStations) {
      const proportional = station.currentPower * scale;
      const newMaxPower = Math.max(0, Math.min(station.maxPower, Math.max(1.4, proportional)));
      this.sendSetChargingProfile(station.id, newMaxPower);
    }
  }

  /**
   * Send SetChargingProfile command to a charging station
   */
  private sendSetChargingProfile(stationId: string, maxPower: number): void {
    const chargingProfile = {
      chargingProfileId: uuidv4(),
      transactionId: null, // For station-wide profile
      stackLevel: 1,
      chargingProfilePurpose: "ChargePointMaxProfile",
      chargingProfileKind: "Absolute",
      chargingSchedule: {
        startSchedule: new Date().toISOString(),
        chargingRateUnit: "W",
        chargingSchedulePeriod: [
          {
            startPeriod: 0,
            limit: maxPower * 1000, // Convert kW to W
            numberPhases: 3
          }
        ]
      }
    };
    
    const message = {
      action: "SetChargingProfile",
      payload: {
        connectorId: 0, // Apply to all connectors
        csChargingProfiles: chargingProfile
      },
      uniqueId: uuidv4(),
      stationId,
    };
    
    console.log(`Sending SetChargingProfile to station ${stationId}:`, message);
    this.sendWsMessage(message);
  }

  public sendRemoteStart(
    stationId: string,
    connectorId: number,
    options: { idTag?: string } = {}
  ): boolean {
    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }
    const message = {
      action: "RemoteStartTransaction",
      payload: {
        connectorId,
        idTag: options.idTag || "bc-charge",
      },
      uniqueId: uuidv4(),
      stationId,
    };
    console.log(`Sending RemoteStartTransaction to ${stationId}, connector ${connectorId}`);
    return this.sendWsMessage(message);
  }

  public sendRemoteStop(
    stationId: string,
    connectorId: number,
    options: { transactionId?: string | number } = {}
  ): boolean {
    const payload: Record<string, unknown> = { connectorId };
    if (options.transactionId !== undefined) {
      payload.transactionId = options.transactionId;
    }
    const message = {
      action: "RemoteStopTransaction",
      payload,
      uniqueId: uuidv4(),
      stationId,
    };
    console.log(`Sending RemoteStopTransaction to ${stationId}, connector ${connectorId}`);
    return this.sendWsMessage(message);
  }

  private sendWsMessage(message: Record<string, unknown>): boolean {
    if (this.citrineWs.readyState === WebSocket.OPEN) {
      this.citrineWs.send(JSON.stringify(message));
      return true;
    }
    console.error(`WebSocket not open, cannot send command to station: ${String(message.stationId || "")}`);
    return false;
  }

  private createSocket(): WebSocket {
    const ws = new WebSocket(this.wsUrl);
    this.attachSocketHandlers(ws);
    return ws;
  }

  /**
   * Setup WebSocket event handlers
   */
  private attachSocketHandlers(ws: WebSocket): void {
    ws.on('open', () => {
      console.log('Connected to CitrineOS WebSocket');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleCitrineMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.intentionalClose) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.intentionalClose) {
        return;
      }
      console.log('LoadManager reconnecting WebSocket...');
      try {
        this.citrineWs = this.createSocket();
      } catch (error) {
        console.error('LoadManager reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, 5_000);
  }

  /**
   * Handle messages from CitrineOS
   */
  private handleCitrineMessage(message: any): void {
    const action = message?.action;
    if (action === "MeterValues") {
      this.handleMeterValues(message);
    } else if (action === "StartTransaction") {
      this.handleStartTransaction(message);
    } else if (action === "TransactionEvent") {
      // OCPP 2.x TransactionEvent: Started / Updated / Ended
      const eventType = String(message?.payload?.eventType || "").toLowerCase();
      if (eventType === "started") {
        this.handleStartTransaction(message);
      } else if (eventType === "ended") {
        this.handleStopTransaction(message);
      } else if (eventType === "updated") {
        // Optional meter updates embedded in TransactionEvent
        this.handleMeterValues(message);
      }
    } else if (action === "StopTransaction") {
      this.handleStopTransaction(message);
    } else if (action === "BootNotification" || action === "StatusNotification") {
      const stationId =
        message?.stationId ||
        message?.payload?.stationId ||
        message?.payload?.chargingStationId;
      if (stationId && !this.stations.has(stationId)) {
        this.registerStation(String(stationId), this.defaultMaxPowerKw);
      }
    } else if (action === "SetChargingProfileResponse") {
      this.handleSetChargingProfileResponse(message);
    }
  }

  /**
   * Handle StopTransaction and trigger idle tracking if connector is still occupied
   */
  private handleStopTransaction(message: any): void {
    const payload = message?.payload || {};
    const stationId =
      message?.stationId ||
      payload.stationId ||
      payload.chargingStationId;
    const connectorId = Number(payload.connectorId ?? payload.connector_id ?? 0);
    const transactionId = payload.transactionId ?? payload.transaction_id;
    const meterStop = payload.meterStop !== undefined
      ? Number(payload.meterStop)
      : payload.meter_stop !== undefined
        ? Number(payload.meter_stop)
        : undefined;

    if (!stationId) {
      console.warn("StopTransaction missing stationId", message);
      return;
    }

    console.log(`StopTransaction received for station ${stationId}, connector ${connectorId}`);

    // Mark station inactive until next MeterValues
    const station = this.stations.get(stationId);
    if (station) {
      station.isActive = false;
      station.currentPower = 0;
      station.lastUpdate = new Date();
    }

    this.emit("transactionStopped", {
      stationId,
      connectorId,
      transactionId,
      meterStop: Number.isFinite(meterStop as number) ? meterStop : undefined,
      timestamp: new Date(),
    });
  }

  private handleStartTransaction(message: any): void {
    const payload = message?.payload || {};
    const stationId =
      message?.stationId ||
      payload.stationId ||
      payload.chargingStationId;
    const connectorId = Number(payload.connectorId ?? 0);
    const meterStart = payload.meterStart !== undefined ? Number(payload.meterStart) : 0;
    if (!stationId) {
      return;
    }
    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }
    this.emit("transactionStarted", {
      stationId,
      connectorId,
      transactionId: payload.transactionId,
      meterStart: Number.isFinite(meterStart) ? meterStart : 0,
      idTag: payload.idTag,
      timestamp: new Date(),
    });
  }


  /**
   * Handle MeterValues messages to update station power
   */
  private handleMeterValues(message: any): void {
    const payload = message?.payload || {};
    const stationId =
      message?.stationId ||
      payload.stationId ||
      payload.chargingStationId;
    const meterValue =
      payload.meterValue ||
      payload.meterValues ||
      payload.meterValueArray;

    // Extract power value from meterValue (OCPP 1.6 / 2.x shapes)
    let powerValue = 0;
    let unit: string | undefined;
    if (meterValue && Array.isArray(meterValue)) {
      outer: for (const value of meterValue) {
        const samples = value.sampledValue || value.sampled_value;
        if (samples && Array.isArray(samples)) {
          for (const sample of samples) {
            const measurand = sample.measurand || sample.Measurand;
            if (measurand === 'Power.Active.Import' || measurand === 'Power.Active.Import.L1') {
              powerValue = parseFloat(sample.value) || 0;
              unit = sample.unit || sample.unitOfMeasure?.unit;
              break outer;
            }
          }
        }
      }
    }

    // Normalize to kW (OCPP often reports W)
    const unitLower = String(unit || '').toLowerCase();
    if (unitLower === 'w' || (!unitLower && powerValue > 100)) {
      powerValue = powerValue / 1000;
    }

    if (!stationId) {
      console.warn("MeterValues missing stationId");
      return;
    }
    if (!this.stations.has(stationId)) {
      this.registerStation(String(stationId), this.defaultMaxPowerKw);
    }
    this.updateStationPower(String(stationId), powerValue);

    // Forward energy meter (kWh) for open pricing sessions when present
    let energyKwh: number | undefined;
    if (meterValue && Array.isArray(meterValue)) {
      for (const value of meterValue) {
        const samples = value.sampledValue || value.sampled_value;
        if (!samples || !Array.isArray(samples)) continue;
        for (const sample of samples) {
          const measurand = sample.measurand || sample.Measurand;
          if (measurand === 'Energy.Active.Import.Register') {
            const raw = parseFloat(sample.value);
            if (!Number.isFinite(raw)) continue;
            const eUnit = String(sample.unit || sample.unitOfMeasure?.unit || '').toLowerCase();
            energyKwh = eUnit === 'wh' ? raw / 1000 : raw;
          }
        }
      }
    }
    if (energyKwh !== undefined) {
      this.emit('meterEnergy', {
        stationId: String(stationId),
        connectorId: Number(payload.connectorId ?? 0),
        energyKwh,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle responses to SetChargingProfile commands
   */
  private handleSetChargingProfileResponse(message: any): void {
    const { status } = message.payload;
    const stationId = message.stationId;
    
    if (status === 'Accepted') {
      console.log(`SetChargingProfile accepted for station ${stationId}`);
    } else {
      console.warn(`SetChargingProfile rejected for station ${stationId}: ${status}`);
    }
  }

  /**
   * Shutdown the LoadManager service
   */
  public shutdown(): void {
    console.log('Shutting down LoadManager service...');
    this.intentionalClose = true;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    if (this.adjustmentTimer) {
      clearTimeout(this.adjustmentTimer);
      this.adjustmentTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (
      this.citrineWs.readyState === WebSocket.OPEN ||
      this.citrineWs.readyState === WebSocket.CONNECTING
    ) {
      this.citrineWs.close();
    }

    console.log('LoadManager service shutdown complete');
  }
}

// Export the LoadManager class
export default LoadManager;