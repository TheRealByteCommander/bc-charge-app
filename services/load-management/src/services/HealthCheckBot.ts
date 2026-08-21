import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { parseCitrineWsEnvelope } from './citrineWsEnvelope';

export type StationHealthStatus =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'faulted'
  | 'unreachable'
  | 'resetting';

export interface StationHealthState {
  stationId: string;
  status: StationHealthStatus;
  lastCheckAt?: Date;
  lastResponseAt?: Date;
  lastStatusRaw?: string;
  consecutiveFailures: number;
  lastError?: string;
  lastResetAt?: Date;
  pendingRequestId?: string;
}

export interface HealthCheckBotOptions {
  citrineWsUrl: string;
  /** How often to poll all stations (ms). Default 5 min. */
  checkIntervalMs?: number;
  /** Wait this long for GetStatusResponse before counting failure (ms). */
  responseTimeoutMs?: number;
  /** Failures in a row before Hard Reset. Default 3. */
  failureThreshold?: number;
  /** Minimum time between resets per station (ms). Default 30 min. */
  resetCooldownMs?: number;
  /** Optional external station id provider (e.g. LoadManager.getStationIds). */
  getStationIds?: () => string[];
}

interface PendingRequest {
  stationId: string;
  requestId: string;
  sentAt: number;
  timer: NodeJS.Timeout;
}

/**
 * Polls chargers via CitrineOS WebSocket and resets unresponsive/faulted units.
 */
export class HealthCheckBot extends EventEmitter {
  private citrineWs: WebSocket;
  private readonly wsUrl: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly stationState = new Map<string, StationHealthState>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly checkIntervalMs: number;
  private readonly responseTimeoutMs: number;
  private readonly failureThreshold: number;
  private readonly resetCooldownMs: number;
  private readonly getStationIds?: () => string[];
  private started = false;
  private intentionalClose = false;

  constructor(options: HealthCheckBotOptions | string) {
    super();
    if (typeof options === 'string') {
      this.wsUrl = options;
      this.checkIntervalMs = 5 * 60 * 1000;
      this.responseTimeoutMs = 30_000;
      this.failureThreshold = 3;
      this.resetCooldownMs = 30 * 60 * 1000;
    } else {
      this.wsUrl = options.citrineWsUrl;
      this.checkIntervalMs = options.checkIntervalMs ?? 5 * 60 * 1000;
      this.responseTimeoutMs = options.responseTimeoutMs ?? 30_000;
      this.failureThreshold = options.failureThreshold ?? 3;
      this.resetCooldownMs = options.resetCooldownMs ?? 30 * 60 * 1000;
      this.getStationIds = options.getStationIds;
    }
    this.citrineWs = this.createSocket();
  }

  public async initialize(stations: string[] = []): Promise<void> {
    console.log('Initializing HealthCheckBot...');
    for (const stationId of stations) {
      this.ensureStation(stationId);
    }
    this.started = true;
    this.startPolling();
    // Initial check shortly after start (allow WS to connect)
    setTimeout(() => {
      void this.performHealthCheck();
    }, 3_000);
    console.log(
      `HealthCheckBot initialized (interval=${this.checkIntervalMs}ms, stations=${this.getTrackedStationIds().length})`
    );
  }

  public setStations(stations: string[]): void {
    const next = new Set(stations.filter(Boolean));
    for (const id of next) {
      this.ensureStation(id);
    }
    // Keep historical state for removed stations but they won't be polled
  }

  public getStationHealth(stationId: string): StationHealthState | undefined {
    const state = this.stationState.get(stationId);
    return state ? { ...state } : undefined;
  }

  public getAllHealth(): StationHealthState[] {
    return this.getTrackedStationIds().map((id) => {
      const state = this.stationState.get(id) || this.ensureStation(id);
      return { ...state };
    });
  }

  public async performHealthCheck(): Promise<void> {
    const stationIds = this.getTrackedStationIds();
    if (stationIds.length === 0) {
      console.log('HealthCheckBot: no stations to check');
      return;
    }
    console.log(`Performing health check for ${stationIds.length} station(s)...`);
    for (const stationId of stationIds) {
      this.sendGetStatus(stationId);
    }
  }

  public shutdown(): void {
    this.started = false;
    this.intentionalClose = true;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
    if (this.citrineWs.readyState === WebSocket.OPEN || this.citrineWs.readyState === WebSocket.CONNECTING) {
      this.citrineWs.close();
    }
  }

  private getTrackedStationIds(): string[] {
    const fromProvider = this.getStationIds?.() ?? [];
    const ids = new Set<string>([...fromProvider, ...this.stationState.keys()]);
    // If provider returns ids, prefer those for polling
    if (fromProvider.length > 0) {
      return fromProvider.filter(Boolean);
    }
    return Array.from(ids).filter(Boolean);
  }

  private ensureStation(stationId: string): StationHealthState {
    let state = this.stationState.get(stationId);
    if (!state) {
      state = {
        stationId,
        status: 'unknown',
        consecutiveFailures: 0,
      };
      this.stationState.set(stationId, state);
    }
    return state;
  }

  private startPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(() => {
      void this.performHealthCheck();
    }, this.checkIntervalMs);
  }

  private createSocket(): WebSocket {
    const ws = new WebSocket(this.wsUrl);
    this.attachSocketHandlers(ws);
    return ws;
  }

  private attachSocketHandlers(ws: WebSocket): void {
    ws.on('open', () => {
      console.log('HealthCheckBot connected to CitrineOS WebSocket');
    });

    ws.on('message', (data) => {
      try {
        const message = parseCitrineWsEnvelope(data);
        if (!message) {
          console.warn('HealthCheckBot: dropping invalid Citrine WS frame');
          return;
        }
        this.handleMessage(message);
      } catch (e) {
        console.error('HealthCheckBot: error handling message:', e);
      }
    });

    ws.on('error', (error) => {
      console.error('HealthCheckBot WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('HealthCheckBot WebSocket closed');
      if (!this.intentionalClose && this.started) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('HealthCheckBot reconnecting WebSocket...');
      this.citrineWs = this.createSocket();
    }, 5_000);
  }

  private sendGetStatus(stationId: string): void {
    const state = this.ensureStation(stationId);
    // Avoid stacking requests for same station
    if (state.pendingRequestId && this.pending.has(state.pendingRequestId)) {
      return;
    }

    const requestId = uuidv4();
    state.lastCheckAt = new Date();
    state.pendingRequestId = requestId;

    const message = {
      action: 'TriggerMessage',
      payload: {
        requestedMessage: 'StatusNotification',
      },
      uniqueId: requestId,
      stationId,
    };

    // Also send a dedicated health probe action used by our stack
    const probe = {
      action: 'GetStatus',
      payload: {},
      uniqueId: requestId,
      stationId,
    };

    const timer = setTimeout(() => {
      this.handleTimeout(requestId, stationId);
    }, this.responseTimeoutMs);

    this.pending.set(requestId, { stationId, requestId, sentAt: Date.now(), timer });
    this.sendWsMessage(probe);
    // TriggerMessage helps OCPP stations push StatusNotification if GetStatus is unsupported
    this.sendWsMessage(message);
  }

  private handleTimeout(requestId: string, stationId: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(requestId);
    const state = this.ensureStation(stationId);
    if (state.pendingRequestId === requestId) {
      state.pendingRequestId = undefined;
    }
    state.status = 'unreachable';
    state.lastError = `No response within ${this.responseTimeoutMs}ms`;
    state.consecutiveFailures += 1;
    console.warn(
      `HealthCheckBot: station ${stationId} unreachable (${state.consecutiveFailures}/${this.failureThreshold})`
    );
    this.maybeReset(stationId, state);
    this.emit('stationUnreachable', { stationId, consecutiveFailures: state.consecutiveFailures });
  }

  private handleMessage(message: any): void {
    const action = message?.action;
    const uniqueId = message?.uniqueId || message?.payload?.uniqueId;
    const stationId =
      message?.stationId ||
      message?.payload?.stationId ||
      message?.payload?.chargingStationId ||
      (uniqueId ? this.pending.get(uniqueId)?.stationId : undefined);

    if (action === 'GetStatusResponse' || action === 'StatusNotification') {
      if (uniqueId && this.pending.has(uniqueId)) {
        const pending = this.pending.get(uniqueId)!;
        clearTimeout(pending.timer);
        this.pending.delete(uniqueId);
      }
      if (!stationId) {
        return;
      }
      this.handleStatusUpdate(stationId, message, uniqueId);
      return;
    }

    if (action === 'ResetResponse' && stationId) {
      const status = message?.payload?.status;
      console.log(`HealthCheckBot: ResetResponse for ${stationId}: ${status}`);
      const state = this.ensureStation(stationId);
      state.status = status === 'Accepted' ? 'resetting' : state.status;
      state.lastResponseAt = new Date();
    }
  }

  private handleStatusUpdate(stationId: string, message: any, uniqueId?: string): void {
    const state = this.ensureStation(stationId);
    if (uniqueId && state.pendingRequestId === uniqueId) {
      state.pendingRequestId = undefined;
    }

    const rawStatus =
      message?.payload?.status ||
      message?.payload?.connectorStatus ||
      message?.payload?.connectorStatuses?.[0]?.status ||
      'Unknown';

    state.lastResponseAt = new Date();
    state.lastStatusRaw = String(rawStatus);
    state.lastError = undefined;

    const normalized = String(rawStatus).toLowerCase();
    if (normalized === 'faulted' || normalized === 'fault') {
      state.status = 'faulted';
      state.consecutiveFailures += 1;
      console.warn(`HealthCheckBot: station ${stationId} faulted`);
      this.maybeReset(stationId, state);
      return;
    }

    if (normalized === 'unavailable' || normalized === 'unknown') {
      state.status = 'degraded';
      state.consecutiveFailures += 1;
      this.maybeReset(stationId, state);
      return;
    }

    // Available, Occupied, Preparing, Charging, SuspendedEV, SuspendedEVSE, Finishing, Reserved, etc.
    state.status = 'healthy';
    state.consecutiveFailures = 0;
    console.log(`Station ${stationId} is healthy (Status: ${rawStatus})`);
    this.emit('stationHealthy', { stationId, status: rawStatus });
  }

  private maybeReset(stationId: string, state: StationHealthState): void {
    if (state.consecutiveFailures < this.failureThreshold) {
      return;
    }
    const now = Date.now();
    if (state.lastResetAt && now - state.lastResetAt.getTime() < this.resetCooldownMs) {
      console.warn(
        `HealthCheckBot: reset cooldown active for ${stationId}, skipping reset`
      );
      return;
    }
    this.sendReset(stationId);
    state.lastResetAt = new Date();
    state.status = 'resetting';
    state.consecutiveFailures = 0;
  }

  private sendReset(stationId: string): void {
    console.warn(`Station ${stationId} failed health check. Triggering Hard Reset...`);
    const message = {
      action: 'Reset',
      payload: {
        type: 'Hard',
      },
      uniqueId: uuidv4(),
      stationId,
    };
    this.sendWsMessage(message);
    this.emit('stationReset', { stationId, at: new Date() });
  }

  private sendWsMessage(message: Record<string, unknown>): void {
    if (this.citrineWs.readyState === WebSocket.OPEN) {
      this.citrineWs.send(JSON.stringify(message));
      return;
    }
    console.error(
      `HealthCheckBot: WebSocket not open, cannot send ${String(message.action)} to ${String(message.stationId || '')}`
    );
  }
}
