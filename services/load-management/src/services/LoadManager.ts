import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { parseCitrineWsEnvelope } from './citrineWsEnvelope';
import {
  deriveLimitKwFromSchedule as deriveLimitKwFromScheduleShape,
  extractChargingScheduleFromPayload,
  isPlainObject,
  normalizeChargingSchedulePeriod,
  readChargingRateUnit,
  readChargingSchedulePeriods,
  readOptionalFiniteNumber,
  readOptionalString,
} from './chargingScheduleShape';
import {
  extractConnectorId as extractConnectorIdShape,
  extractEnergyKwhFromMeterValue as extractEnergyKwhFromMeterValueShape,
  extractIdTag as extractIdTagShape,
  extractMeterStartKwh,
  extractMeterStopKwh,
  extractMeterValueArray as extractMeterValueArrayShape,
  extractPowerKwFromMeterValue,
  extractStationId as extractStationIdShape,
  extractTransactionEventType,
  extractTransactionId as extractTransactionIdShape,
} from './ocppMeterTransactionShape';

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

/** OCPP 2.0.1 ChargingLimitSourceEnumType */
export type ChargingLimitSource = 'EMS' | 'Other' | 'SO' | 'CSO';

export interface ExternalChargingLimit {
  stationId: string;
  evseId: number;
  source: ChargingLimitSource;
  isGridCritical: boolean;
  /** Derived station-wide cap in kW when schedule periods are present */
  limitKw: number | null;
  chargingSchedule?: unknown;
  receivedAt: Date;
  raw?: unknown;
}

export interface CompositeSchedulePeriod {
  startPeriod: number;
  limit: number;
  numberPhases?: number;
}

export interface CompositeSchedule {
  stationId: string;
  evseId: number;
  status: string;
  duration?: number;
  chargingRateUnit?: string;
  startSchedule?: string;
  chargingSchedulePeriod: CompositeSchedulePeriod[];
  /** Lowest period limit converted to kW when unit is W/A-ish */
  effectiveLimitKw: number | null;
  fetchedAt: Date;
  raw?: unknown;
}

interface PendingCompositeRequest {
  stationId: string;
  requestId: string;
  evseId: number;
  sentAt: number;
  timer: NodeJS.Timeout;
  resolve: (value: CompositeSchedule | null) => void;
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
  /** External limits from NotifyChargingLimit (EMS/SO/…) keyed by stationId */
  private externalLimits: Map<string, ExternalChargingLimit> = new Map();
  /** Last successful GetCompositeSchedule per stationId */
  private compositeSchedules: Map<string, CompositeSchedule> = new Map();
  private pendingComposite = new Map<string, PendingCompositeRequest>();
  private citrineWs: WebSocket;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private adjustmentTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private readonly wsUrl: string;
  private readonly defaultMaxPowerKw: number;
  private readonly compositeTimeoutMs: number;
  /** Monotonic counter mixed into OCPP integer chargingProfileId (not UUID). */
  private profileIdSeq = 0;

  constructor(config: LoadManagementConfig, citrineWsUrl: string, defaultMaxPowerKw = 22) {
    super();
    this.config = config;
    this.wsUrl = citrineWsUrl;
    this.defaultMaxPowerKw = defaultMaxPowerKw;
    this.compositeTimeoutMs = Number(process.env.COMPOSITE_SCHEDULE_TIMEOUT_MS || 15_000);
    this.citrineWs = this.createSocket();
  }

  /**
   * OCPP 2.0.1 ChargingProfileType.id / chargingProfileId is integer (1..2^31-1).
   * UUID strings are schema-invalid and stations/Citrine may reject the profile.
   */
  private nextChargingProfileId(): number {
    this.profileIdSeq = (this.profileIdSeq + 1) % 1_000_000;
    const mixed =
      ((Date.now() % 2_000_000) * 1_000) +
      this.profileIdSeq +
      Math.floor(Math.random() * 997);
    const id = mixed % 2_147_483_647;
    return id === 0 ? 1 : id;
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

  public getExternalLimit(stationId: string): ExternalChargingLimit | undefined {
    const limit = this.externalLimits.get(stationId);
    return limit ? { ...limit } : undefined;
  }

  public getExternalLimits(): ExternalChargingLimit[] {
    return Array.from(this.externalLimits.values()).map((l) => ({ ...l }));
  }

  public getCompositeSchedule(stationId: string): CompositeSchedule | undefined {
    const schedule = this.compositeSchedules.get(stationId);
    return schedule
      ? {
          ...schedule,
          chargingSchedulePeriod: schedule.chargingSchedulePeriod.map((p) => ({ ...p })),
        }
      : undefined;
  }

  public getCompositeSchedules(): CompositeSchedule[] {
    return this.getStationIds()
      .map((id) => this.getCompositeSchedule(id))
      .filter((s): s is CompositeSchedule => Boolean(s));
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
   * OCPP 2.0.1 GetCompositeSchedule — request merged schedule for EVSE/station.
   * Resolves with parsed schedule or null on timeout/reject/WS-down.
   */
  public requestCompositeSchedule(
    stationId: string,
    options: {
      durationSeconds?: number;
      chargingRateUnit?: 'W' | 'A';
      evseId?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<CompositeSchedule | null> {
    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }

    const evseId = options.evseId ?? 0;
    const duration = options.durationSeconds ?? 86400;
    const chargingRateUnit = options.chargingRateUnit ?? 'W';
    const timeoutMs = options.timeoutMs ?? this.compositeTimeoutMs;
    const requestId = uuidv4();

    const message = {
      action: 'GetCompositeSchedule',
      payload: {
        duration,
        chargingRateUnit,
        evseId,
      },
      uniqueId: requestId,
      stationId,
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingComposite.delete(requestId);
        console.warn(
          `GetCompositeSchedule timeout for station ${stationId} (request ${requestId})`
        );
        resolve(null);
      }, timeoutMs);

      this.pendingComposite.set(requestId, {
        stationId,
        requestId,
        evseId,
        sentAt: Date.now(),
        timer,
        resolve,
      });

      const sent = this.sendWsMessage(message);
      if (!sent) {
        clearTimeout(timer);
        this.pendingComposite.delete(requestId);
        resolve(null);
      }
    });
  }

  /**
   * Refresh composite schedules for all known stations (best-effort).
   */
  public async refreshAllCompositeSchedules(
    options: { durationSeconds?: number; chargingRateUnit?: 'W' | 'A' } = {}
  ): Promise<Array<CompositeSchedule | null>> {
    const ids = this.getStationIds();
    return Promise.all(ids.map((id) => this.requestCompositeSchedule(id, options)));
  }

  /**
   * Clear a stored external limit (e.g. after ClearedChargingLimit).
   */
  public clearExternalLimit(stationId: string, source?: ChargingLimitSource): boolean {
    const existing = this.externalLimits.get(stationId);
    if (!existing) return false;
    if (source && existing.source !== source) return false;
    this.externalLimits.delete(stationId);
    this.emit('externalLimitCleared', { stationId, source: source ?? existing.source });
    // Re-run load check so site-level shedding can re-apply without external cap
    this.checkLoadAdjustment();
    return true;
  }

  /**
   * Effective operational ceiling for a station: min(hardware max, external limit if any).
   */
  public getEffectiveMaxPowerKw(stationId: string): number | null {
    const station = this.stations.get(stationId);
    if (!station) return null;
    const ext = this.externalLimits.get(stationId);
    if (ext?.limitKw != null && Number.isFinite(ext.limitKw)) {
      return Math.min(station.maxPower, Math.max(0, ext.limitKw));
    }
    return station.maxPower;
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
      const ceiling =
        this.getEffectiveMaxPowerKw(station.id) ?? station.maxPower;
      const target = Math.min(ceiling, Math.max(minPerStationKw, share));
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
      const ceiling = this.getEffectiveMaxPowerKw(station.id) ?? station.maxPower;
      const newMaxPower = Math.max(0, Math.min(ceiling, Math.max(1.4, proportional)));
      this.sendSetChargingProfile(station.id, newMaxPower);
    }
  }

  /**
   * Send SetChargingProfile command to a charging station
   */
  private sendSetChargingProfile(stationId: string, maxPower: number): void {
    const ceiling = this.getEffectiveMaxPowerKw(stationId);
    const capped =
      ceiling != null && Number.isFinite(ceiling) ? Math.min(maxPower, ceiling) : maxPower;
    maxPower = Math.max(0, capped);

    // OCPP 2.0.1 K01: station-wide cap is ChargingStationMaxProfile (not 1.6 ChargePointMaxProfile).
    // Absolute profiles require startSchedule — stations reject missing startSchedule (see CitrineOS #785).
    // chargingProfileId must be integer (OCPP schema) — never a UUID string.
    const chargingProfile = {
      chargingProfileId: this.nextChargingProfileId(),
      stackLevel: 1,
      chargingProfilePurpose: "ChargingStationMaxProfile",
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
        evseId: 0, // 2.0.1: station-wide when evseId=0 (1.6 used connectorId=0)
        chargingProfile,
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
        const message = parseCitrineWsEnvelope(data);
        if (!message) {
          console.warn('LoadManager: dropping invalid Citrine WS frame');
          return;
        }
        this.handleCitrineMessage(message);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
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
      // OCPP 2.x TransactionEvent: Started / Updated / Ended (camel + snake event_type)
      const payload = isPlainObject(message?.payload) ? message.payload : {};
      const eventType = extractTransactionEventType(payload);
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
      const payload = isPlainObject(message?.payload) ? message.payload : {};
      const stationId = this.extractStationId(message, payload);
      if (stationId && !this.stations.has(stationId)) {
        this.registerStation(stationId, this.defaultMaxPowerKw);
      }
    } else if (action === 'NotifyChargingLimit') {
      this.handleNotifyChargingLimit(message);
    } else if (action === 'ClearedChargingLimit') {
      this.handleClearedChargingLimit(message);
    } else if (
      action === 'GetCompositeScheduleResponse' ||
      action === 'GetCompositeSchedule'
    ) {
      // Some gateways wrap the response action as GetCompositeSchedule with status
      this.handleGetCompositeScheduleResponse(message);
    } else if (action === "SetChargingProfileResponse") {
      this.handleSetChargingProfileResponse(message);
    }
  }

  /**
   * Resolve station id from top-level or payload aliases (OCPP 1.6 + 2.x / CitrineOS).
   * Delegates to shared parse-don't-cast helper.
   */
  private extractStationId(message: unknown, payload: unknown): string | null {
    return extractStationIdShape(message, payload);
  }

  /** OCPP 2.0.1 evse nest + 1.6 connectorId — shared shape helper. */
  private extractConnectorId(payload: unknown): number {
    return extractConnectorIdShape(payload);
  }

  /** OCPP 2.0.1 transactionInfo + 1.6 flat id — shared shape helper. */
  private extractTransactionId(payload: unknown): string | number | undefined {
    return extractTransactionIdShape(payload);
  }

  private extractIdTag(payload: unknown): string | undefined {
    return extractIdTagShape(payload);
  }

  /** Energy.Active.Import.Register from meterValue[] (Wh/kWh). */
  private extractEnergyKwhFromMeterValue(meterValue: unknown): number | undefined {
    return extractEnergyKwhFromMeterValueShape(meterValue);
  }

  private extractMeterValueArray(payload: unknown): unknown {
    return extractMeterValueArrayShape(payload);
  }

  /**
   * Handle StopTransaction and trigger idle tracking if connector is still occupied
   */
  private handleStopTransaction(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const stationId = this.extractStationId(message, payload);
    const connectorId = this.extractConnectorId(payload);
    const transactionId = this.extractTransactionId(payload);
    // OCPP 2.x Ended often only carries energy in meterValue[], not meterStop
    const meterStop = extractMeterStopKwh(payload);

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
      meterStop: meterStop !== undefined && Number.isFinite(meterStop) ? meterStop : undefined,
      timestamp: new Date(),
    });
  }

  private handleStartTransaction(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const stationId = this.extractStationId(message, payload);
    const connectorId = this.extractConnectorId(payload);
    const transactionId = this.extractTransactionId(payload);
    const idTag = this.extractIdTag(payload);
    const meterStart = extractMeterStartKwh(payload);

    if (!stationId) {
      return;
    }
    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }
    this.emit("transactionStarted", {
      stationId,
      connectorId,
      transactionId,
      meterStart: Number.isFinite(meterStart) ? meterStart : 0,
      idTag,
      timestamp: new Date(),
    });
  }


  /**
   * Handle MeterValues messages to update station power
   */
  private handleMeterValues(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const stationId = this.extractStationId(message, payload);
    const connectorId = this.extractConnectorId(payload);
    const meterValue = this.extractMeterValueArray(payload);
    const powerValue = extractPowerKwFromMeterValue(meterValue);

    if (!stationId) {
      console.warn("MeterValues missing stationId");
      return;
    }
    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }
    this.updateStationPower(stationId, powerValue);

    // Forward energy meter (kWh) for open pricing sessions when present
    const energyKwh = this.extractEnergyKwhFromMeterValue(meterValue);
    if (energyKwh !== undefined) {
      this.emit('meterEnergy', {
        stationId,
        connectorId,
        energyKwh,
        timestamp: new Date(),
      });
    }
  }

  private normalizeChargingLimitSource(raw: unknown): ChargingLimitSource {
    const s = String(raw ?? 'Other').toUpperCase();
    if (s === 'EMS') return 'EMS';
    if (s === 'SO') return 'SO';
    if (s === 'CSO') return 'CSO';
    return 'Other';
  }

  /**
   * Lowest limit from schedule period(s), normalized to kW when unit is W/A.
   * Delegates to shared parse-don't-cast helper (camel + snake aliases).
   */
  private deriveLimitKwFromSchedule(
    schedule: unknown,
    fallbackUnit?: string
  ): number | null {
    return deriveLimitKwFromScheduleShape(schedule, fallbackUnit);
  }

  /**
   * OCPP 2.0.1 NotifyChargingLimit — CS reports external EMS/SO/CSO limit.
   * We store it, optionally apply SetChargingProfile, and emit externalLimit.
   */
  private handleNotifyChargingLimit(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const stationId = this.extractStationId(message, payload);
    if (!stationId) {
      console.warn('NotifyChargingLimit missing stationId', message);
      return;
    }

    if (!this.stations.has(stationId)) {
      this.registerStation(stationId, this.defaultMaxPowerKw);
    }

    const chargingLimitRaw = payload.chargingLimit ?? payload.charging_limit;
    const chargingLimit = isPlainObject(chargingLimitRaw) ? chargingLimitRaw : {};
    const source = this.normalizeChargingLimitSource(
      chargingLimit.chargingLimitSource ?? chargingLimit.charging_limit_source
    );
    const isGridCritical = Boolean(
      chargingLimit.isGridCritical ?? chargingLimit.is_grid_critical ?? false
    );
    const evseId = Number(
      payload.evseId ?? payload.evse_id ?? this.extractConnectorId(payload) ?? 0
    );
    const schedule =
      extractChargingScheduleFromPayload(payload) ??
      extractChargingScheduleFromPayload(chargingLimit);
    const limitKw = this.deriveLimitKwFromSchedule(schedule);

    const entry: ExternalChargingLimit = {
      stationId,
      evseId: Number.isFinite(evseId) ? evseId : 0,
      source,
      isGridCritical,
      limitKw,
      chargingSchedule: schedule,
      receivedAt: new Date(),
      raw: payload,
    };

    this.externalLimits.set(stationId, entry);
    console.log(
      `NotifyChargingLimit ${stationId}: source=${source} gridCritical=${isGridCritical}` +
        (limitKw != null ? ` limitKw=${limitKw.toFixed(2)}` : ' (no schedule limit)')
    );

    // Apply external cap immediately when we can derive kW
    if (limitKw != null && Number.isFinite(limitKw)) {
      this.sendSetChargingProfile(stationId, limitKw);
    }

    this.emit('externalLimit', entry);
    this.checkLoadAdjustment();
  }

  private handleClearedChargingLimit(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const stationId = this.extractStationId(message, payload);
    if (!stationId) return;
    const nestedLimit = isPlainObject(payload.chargingLimit)
      ? payload.chargingLimit
      : isPlainObject(payload.charging_limit)
        ? payload.charging_limit
        : null;
    const sourceRaw =
      payload.chargingLimitSource ??
      payload.charging_limit_source ??
      nestedLimit?.chargingLimitSource ??
      nestedLimit?.charging_limit_source;
    const source = sourceRaw
      ? this.normalizeChargingLimitSource(sourceRaw)
      : undefined;
    this.clearExternalLimit(stationId, source);
  }

  private handleGetCompositeScheduleResponse(message: any): void {
    const payload = isPlainObject(message?.payload) ? message.payload : {};
    const uniqueId = String(
      message?.uniqueId ?? message?.unique_id ?? message?.messageId ?? ''
    );
    const pending = uniqueId ? this.pendingComposite.get(uniqueId) : undefined;

    const stationId =
      this.extractStationId(message, payload) || pending?.stationId || null;
    if (!stationId) {
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingComposite.delete(uniqueId);
        pending.resolve(null);
      }
      return;
    }

    const status = String(payload.status ?? message?.status ?? 'Unknown');
    const schedule = extractChargingScheduleFromPayload(payload);
    const evseId = Number(
      payload.evseId ?? payload.evse_id ?? pending?.evseId ?? 0
    );

    const periods: CompositeSchedulePeriod[] = readChargingSchedulePeriods(schedule)
      .map((p) => normalizeChargingSchedulePeriod(p))
      .filter((p): p is CompositeSchedulePeriod => p != null);

    const unit = schedule ? readChargingRateUnit(schedule, 'W') : undefined;
    const effectiveLimitKw =
      status.toLowerCase() === 'accepted'
        ? this.deriveLimitKwFromSchedule(schedule, unit)
        : null;

    const scheduleObj = isPlainObject(schedule) ? schedule : null;
    // OCPP duration is seconds. Until Citrine #894 lands, upstream TxProfile durations may be
    // wrong-unit — keep as opaque number for telemetry; do not convert to wall-clock billing windows.
    const composite: CompositeSchedule = {
      stationId,
      evseId: Number.isFinite(evseId) ? evseId : 0,
      status,
      duration: scheduleObj
        ? readOptionalFiniteNumber(scheduleObj.duration)
        : undefined,
      chargingRateUnit: unit,
      startSchedule: scheduleObj
        ? readOptionalString(
            scheduleObj.startSchedule ?? scheduleObj.start_schedule
          )
        : undefined,
      chargingSchedulePeriod: periods,
      effectiveLimitKw,
      fetchedAt: new Date(),
      raw: payload,
    };

    if (status.toLowerCase() === 'accepted') {
      this.compositeSchedules.set(stationId, composite);
      // If composite is tighter than current power, apply profile
      if (effectiveLimitKw != null) {
        const station = this.stations.get(stationId);
        if (station?.isActive && station.currentPower > effectiveLimitKw) {
          this.sendSetChargingProfile(stationId, effectiveLimitKw);
        }
      }
    }

    this.emit('compositeSchedule', composite);

    if (pending) {
      clearTimeout(pending.timer);
      this.pendingComposite.delete(uniqueId);
      pending.resolve(status.toLowerCase() === 'accepted' ? composite : null);
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

    for (const pending of this.pendingComposite.values()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingComposite.clear();

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