import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for time-based tariff periods
 */
export interface TariffPeriod {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  pricePerKwh: number; // Price in EUR/kWh
  idleFeePerMin?: number; // Optional idle fee in EUR/min
}

/**
 * Interface for charging session data
 */
export interface ChargingSession {
  id: string;
  stationId: string;
  connectorId: number;
  startTimestamp: Date;
  endTimestamp?: Date;
  startMeterValue: number; // kWh
  endMeterValue?: number; // kWh
  totalEnergy?: number; // kWh
  totalPrice?: number; // EUR
  idleStartTime?: Date; // When idle period started
  idleDuration?: number; // minutes
  idleFee?: number; // EUR
  tariffApplied?: TariffPeriod;
  status: 'active' | 'completed' | 'idle' | 'cancelled';
  customerId?: string;
  locationId?: string;
  source?: 'api' | 'deeplink' | 'ocpp' | 'unknown';
  deepLinkToken?: string;
  cancelReason?: string;
  /** OCPP / CitrineOS transaction id when known */
  transactionId?: string | number;
}

/**
 * Configuration for the pricing service
 */
export interface PricingConfig {
  defaultPricePerKwh: number; // Default price in EUR/kWh
  defaultIdleFeePerMin: number; // Default idle fee in EUR/min
  currency: string; // Currency code (e.g., 'EUR')
  timezone: string; // Timezone for tariff calculations
}

/**
 * Service for dynamic pricing calculations including time-based tariffs,
 * idle fees, and energy pass-through pricing.
 */
export class PricingService {
  private _tariffPeriods: TariffPeriod[] = [];
  private _sessions: Map<string, ChargingSession> = new Map();
  private _config: PricingConfig;
  private _logService: any;

  constructor(config: PricingConfig, logService: any) {
    this._config = config;
    this._logService = logService;
    
    // Add default tariff period covering 24 hours
    this._tariffPeriods.push({
      startTime: '00:00',
      endTime: '23:59',
      pricePerKwh: config.defaultPricePerKwh,
      idleFeePerMin: config.defaultIdleFeePerMin
    });
  }

  /**
   * Add a tariff period
   * @param period Tariff period to add
   */
  public addTariffPeriod(period: TariffPeriod): void {
    this._tariffPeriods.push(period);
    // Sort periods by start time
    this._tariffPeriods.sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
    this._logService.info(`Added tariff period: ${period.startTime}-${period.endTime}`);
  }

  /**
   * Get all tariff periods
   * @returns Array of tariff periods
   */
  public getTariffPeriods(): TariffPeriod[] {
    return [...this._tariffPeriods];
  }

  /**
   * Get the applicable tariff for a specific time
   * @param timestamp Time to check
   * @returns Applicable tariff period
   */
  public getApplicableTariff(timestamp: Date): TariffPeriod {
    const timeStr = timestamp.toTimeString().substring(0, 5); // HH:MM format
    
    // Sort periods by start time to ensure consistent processing
    // But prioritize non-default periods over the default one
    const nonDefaultPeriods = this._tariffPeriods.filter(p => !(p.startTime === '00:00' && p.endTime === '23:59'));
    const defaultPeriod = this._tariffPeriods.find(p => p.startTime === '00:00' && p.endTime === '23:59');
    
    const sortedPeriods = [...nonDefaultPeriods].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Add default period at the end
    if (defaultPeriod) {
      sortedPeriods.push(defaultPeriod);
    }
    
    // Find the tariff period that covers this time
    // Check non-default periods first
    for (const period of nonDefaultPeriods) {
      // Handle overnight periods (e.g., 22:00-06:00)
      if (period.startTime > period.endTime) {
        // Overnight period
        if (timeStr >= period.startTime || timeStr <= period.endTime) {
          return period;
        }
      } else {
        // Regular period
        if (timeStr >= period.startTime && timeStr <= period.endTime) {
          return period;
        }
      }
    }
    
    // Return default period if no specific period matches
    return defaultPeriod || this._tariffPeriods[0];
  }

  /**
   * Start a new charging session
   * @param stationId Charging station ID
   * @param connectorId Connector ID
   * @param startMeterValue Starting meter value in kWh
   * @param options Optional session metadata (customer, source, deep-link)
   * @returns Session ID
   */
  public startSession(
    stationId: string,
    connectorId: number,
    startMeterValue: number,
    options: {
      customerId?: string;
      locationId?: string;
      source?: ChargingSession['source'];
      deepLinkToken?: string;
      transactionId?: string | number;
    } = {}
  ): string {
    if (!Number.isFinite(startMeterValue) || startMeterValue < 0) {
      throw new Error('startMeterValue must be a non-negative number');
    }

    const existing = this.findActiveSession(stationId, connectorId);
    if (existing) {
      throw new Error(
        `Active session ${existing.id} already exists for ${stationId}/connector ${connectorId}`
      );
    }

    const sessionId = uuidv4();
    const now = new Date();
    const tariff = this.getApplicableTariff(now);

    const session: ChargingSession = {
      id: sessionId,
      stationId,
      connectorId,
      startTimestamp: now,
      startMeterValue,
      status: 'active',
      tariffApplied: tariff,
      customerId: options.customerId,
      locationId: options.locationId,
      source: options.source || 'api',
      deepLinkToken: options.deepLinkToken,
      transactionId: options.transactionId,
    };

    this._sessions.set(sessionId, session);
    this._logService.info(`Started charging session ${sessionId} at station ${stationId}`);

    return sessionId;
  }

  /**
   * Find the active session for a station/connector pair.
   */
  public findActiveSession(stationId: string, connectorId: number): ChargingSession | undefined {
    return Array.from(this._sessions.values()).find(
      (session) =>
        session.status === 'active' &&
        session.stationId === stationId &&
        session.connectorId === connectorId
    );
  }

  /**
   * Find active or idle session for station/connector (stop/idle flows).
   */
  public findOpenSession(stationId: string, connectorId: number): ChargingSession | undefined {
    return Array.from(this._sessions.values()).find(
      (session) =>
        (session.status === 'active' || session.status === 'idle') &&
        session.stationId === stationId &&
        session.connectorId === connectorId
    );
  }

  /**
   * Cancel an active session without billing (e.g. remote start failed).
   */
  public cancelSession(sessionId: string, reason = 'cancelled'): ChargingSession {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active (status=${session.status})`);
    }
    session.status = 'cancelled';
    session.endTimestamp = new Date();
    session.cancelReason = reason;
    session.totalEnergy = 0;
    session.totalPrice = 0;
    this._logService.info(`Cancelled charging session ${sessionId}: ${reason}`);
    return session;
  }

  /**
   * End session by station/connector if present.
   */
  public endSessionForConnector(
    stationId: string,
    connectorId: number,
    endMeterValue?: number
  ): ChargingSession | undefined {
    const session = this.findActiveSession(stationId, connectorId);
    if (!session) {
      return undefined;
    }
    const meter =
      endMeterValue !== undefined && Number.isFinite(endMeterValue)
        ? endMeterValue
        : session.endMeterValue ?? session.startMeterValue;
    return this.endSession(session.id, meter);
  }

  /**
   * Sessions eligible for billing export (completed or idle with price).
   */
  public getBillableSessions(): ChargingSession[] {
    return Array.from(this._sessions.values()).filter(
      (session) =>
        (session.status === 'completed' || session.status === 'idle') &&
        session.totalPrice !== undefined &&
        Number.isFinite(session.totalPrice)
    );
  }

  public setSessionTransactionId(
    sessionId: string,
    transactionId: string | number
  ): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.transactionId = transactionId;
  }

  public getSessionTransactionId(sessionId: string): string | number | undefined {
    return this._sessions.get(sessionId)?.transactionId;
  }

  /**
   * Update session with current meter value
   * @param sessionId Session ID
   * @param meterValue Current meter value in kWh
   */
  public updateSessionMeterValue(sessionId: string, meterValue: number): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (!Number.isFinite(meterValue) || meterValue < 0) {
      throw new Error('meterValue must be a non-negative number');
    }

    // Update total energy if session is active
    if (session.status === 'active') {
      session.endMeterValue = meterValue;
      session.totalEnergy = Math.max(0, meterValue - session.startMeterValue);
    }

    this._logService.debug(`Updated session ${sessionId} meter value to ${meterValue}kWh`);
  }

  /**
   * End a charging session
   * @param sessionId Session ID
   * @param endMeterValue Ending meter value in kWh
   * @returns Completed session with pricing
   */
  public endSession(sessionId: string, endMeterValue: number): ChargingSession {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status === 'cancelled') {
      throw new Error(`Session ${sessionId} is cancelled and cannot be ended for billing`);
    }
    if (session.status === 'completed' || session.status === 'idle') {
      // Idempotent: refresh meter/price if still open-ish, else return as-is
      return session;
    }
    if (!Number.isFinite(endMeterValue) || endMeterValue < 0) {
      throw new Error('endMeterValue must be a non-negative number');
    }

    const now = new Date();
    session.endTimestamp = now;
    session.endMeterValue = endMeterValue;
    session.totalEnergy = Math.max(0, endMeterValue - session.startMeterValue);
    session.status = 'completed';

    // Calculate pricing
    this._calculateSessionPricing(session);

    this._logService.info(
      `Ended charging session ${sessionId}, total energy: ${session.totalEnergy}kWh, total price: ${session.totalPrice}EUR`
    );

    return session;
  }

  /**
   * Start idle fee tracking for a completed session.
   * If the session is still active, it is completed first using endMeterValue / last known meter.
   */
  public startIdleTracking(sessionId: string, endMeterValue?: number): void {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === 'active') {
      const meter =
        endMeterValue !== undefined && Number.isFinite(endMeterValue)
          ? endMeterValue
          : session.endMeterValue ?? session.startMeterValue;
      this.endSession(sessionId, meter);
    }

    const current = this._sessions.get(sessionId);
    if (!current) {
      throw new Error(`Session ${sessionId} not found after completion`);
    }
    if (current.status === 'idle') {
      return;
    }
    if (current.status !== 'completed') {
      throw new Error(
        `Session ${sessionId} must be completed before idle tracking (status=${current.status})`
      );
    }

    const now = new Date();
    current.idleStartTime = now;
    current.status = 'idle';

    this._logService.info(`Started idle tracking for session ${sessionId}`);
  }

  /**
   * End idle fee tracking and calculate idle fee
   * @param sessionId Session ID
   * @returns Updated session with idle fee
   */
  public endIdleTracking(sessionId: string): ChargingSession {
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    if (session.status !== 'idle') {
      throw new Error(`Session ${sessionId} is not in idle state`);
    }
    
    const now = new Date();
    const idleDurationMs = now.getTime() - (session.idleStartTime?.getTime() || now.getTime());
    const idleDurationMinutes = Math.ceil(idleDurationMs / (1000 * 60)); // Round up to nearest minute
    
    session.idleDuration = idleDurationMinutes;
    
    // Calculate idle fee using the tariff that was active when session ended
    const tariff = session.tariffApplied || this.getApplicableTariff(now);
    const idleFeePerMin = tariff.idleFeePerMin !== undefined ? tariff.idleFeePerMin : this._config.defaultIdleFeePerMin;
    session.idleFee = idleFeePerMin * idleDurationMinutes;
    
    // Add idle fee to total price
    if (session.totalPrice !== undefined) {
      session.totalPrice += session.idleFee;
    } else {
      session.totalPrice = session.idleFee;
    }
    
    session.status = 'completed';
    
    this._logService.info(`Ended idle tracking for session ${sessionId}, idle duration: ${idleDurationMinutes}min, idle fee: ${session.idleFee}EUR`);
    
    return session;
  }

  /**
   * Get a session by ID
   * @param sessionId Session ID
   * @returns Charging session
   */
  public getSession(sessionId: string): ChargingSession | undefined {
    return this._sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   * @returns Array of active sessions
   */
  public getActiveSessions(): ChargingSession[] {
    return Array.from(this._sessions.values()).filter(session => session.status === 'active');
  }

  /**
   * Calculate pricing for a session
   * @param session Charging session
   */
  private _calculateSessionPricing(session: ChargingSession): void {
    if (session.totalEnergy === undefined) {
      return;
    }
    
    // Get the tariff that was active when session started (or current tariff if not set)
    const tariff = session.tariffApplied || this.getApplicableTariff(session.startTimestamp);
    
    // Calculate energy cost
    const energyCost = session.totalEnergy * tariff.pricePerKwh;
    
    session.tariffApplied = tariff;
    session.totalPrice = energyCost;
    
    this._logService.debug(`Calculated pricing for session ${session.id}: ${session.totalEnergy}kWh * ${tariff.pricePerKwh}EUR/kWh = ${energyCost}EUR`);
  }

  /**
   * Update energy prices dynamically (pass-through pricing)
   * @param newPricePerKwh New price per kWh
   */
  public updateEnergyPrice(newPricePerKwh: number): void {
    // Update default price
    this._config.defaultPricePerKwh = newPricePerKwh;
    
    // Update default tariff period
    const defaultPeriod = this._tariffPeriods.find(p => p.startTime === '00:00' && p.endTime === '23:59');
    if (defaultPeriod) {
      defaultPeriod.pricePerKwh = newPricePerKwh;
    }
    
    this._logService.info(`Updated energy price to ${newPricePerKwh}EUR/kWh`);
  }

  /**
   * Get current configuration
   * @returns Current pricing configuration
   */
  public getConfig(): PricingConfig {
    return { ...this._config };
  }
}