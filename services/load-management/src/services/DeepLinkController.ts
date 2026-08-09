import { Request, Response, NextFunction } from 'express';
import { LoadManager } from './LoadManager';
import { PricingService, ChargingSession } from './pricing';
import {
  CreateDeepLinkTokenInput,
  DeepLinkTokenStore,
} from './DeepLinkTokenStore';

/**
 * Deep-link charging API: token issue/revoke + remote start/stop.
 */
export class DeepLinkController {
  constructor(
    private readonly loadManager: LoadManager,
    private readonly pricingService: PricingService,
    private readonly tokenStore: DeepLinkTokenStore
  ) {}

  /**
   * POST /api/deep-link/tokens
   * Body: { stationId, connectorId, purpose?, customerId?, locationId?, idTag?, ttlSeconds?, maxUses?, metadata? }
   */
  public async createToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        stationId,
        connectorId,
        purpose,
        customerId,
        locationId,
        idTag,
        ttlSeconds,
        maxUses,
        expiresAt,
        metadata,
      } = req.body ?? {};

      if (!stationId || connectorId === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: stationId, connectorId',
        });
        return;
      }

      if (typeof stationId !== 'string') {
        res.status(400).json({ success: false, message: 'stationId must be a string' });
        return;
      }

      const connector = Number(connectorId);
      if (!Number.isInteger(connector) || connector < 0) {
        res.status(400).json({
          success: false,
          message: 'connectorId must be a non-negative integer',
        });
        return;
      }

      if (purpose !== undefined && purpose !== 'start' && purpose !== 'stop' && purpose !== 'both') {
        res.status(400).json({
          success: false,
          message: 'purpose must be one of: start, stop, both',
        });
        return;
      }

      const input: CreateDeepLinkTokenInput = {
        stationId,
        connectorId: connector,
        purpose,
        customerId: typeof customerId === 'string' ? customerId : undefined,
        locationId: typeof locationId === 'string' ? locationId : undefined,
        idTag: typeof idTag === 'string' ? idTag : undefined,
        ttlSeconds: ttlSeconds !== undefined ? Number(ttlSeconds) : undefined,
        maxUses: maxUses !== undefined ? Number(maxUses) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      };

      if (input.ttlSeconds !== undefined && (!Number.isFinite(input.ttlSeconds) || input.ttlSeconds < 60)) {
        res.status(400).json({
          success: false,
          message: 'ttlSeconds must be a number >= 60',
        });
        return;
      }

      if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) {
        res.status(400).json({ success: false, message: 'expiresAt must be a valid ISO date' });
        return;
      }

      // Ensure station is known to load manager (registers if missing)
      this.loadManager.registerStation(stationId, this.loadManager.getDefaultMaxPower());

      const record = this.tokenStore.create(input);
      res.status(201).json({
        success: true,
        data: {
          token: record.token,
          stationId: record.stationId,
          connectorId: record.connectorId,
          purpose: record.purpose,
          expiresAt: record.expiresAt,
          maxUses: record.maxUses,
          links: {
            start: `/api/deep-link/start/${record.token}`,
            stop: `/api/deep-link/stop/${record.token}`,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && /required|must be|future/i.test(error.message)) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/deep-link/tokens
   */
  public async listTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeRevoked = String(req.query.includeRevoked || 'false') === 'true';
      const tokens = this.tokenStore.list(includeRevoked).map((t) => ({
        token: t.token,
        stationId: t.stationId,
        connectorId: t.connectorId,
        purpose: t.purpose,
        customerId: t.customerId,
        locationId: t.locationId,
        maxUses: t.maxUses,
        useCount: t.useCount,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
      }));
      res.status(200).json({ success: true, data: { tokens } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/deep-link/tokens/:token
   */
  public async revokeToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token) {
        res.status(400).json({ success: false, message: 'Missing token' });
        return;
      }
      const ok = this.tokenStore.revoke(token);
      if (!ok) {
        res.status(404).json({ success: false, message: 'Token not found or already revoked' });
        return;
      }
      res.status(200).json({ success: true, message: 'Token revoked' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/deep-link/start/:token
   */
  public async startCharging(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token) {
        res.status(400).json({ success: false, message: 'Missing token' });
        return;
      }

      // Peek first so failed preconditions do not burn a use
      const peeked = this.tokenStore.peek(token, 'start');
      if (!peeked.ok) {
        res.status(this.statusForResolveError(peeked.code)).json({
          success: false,
          code: peeked.code,
          message: peeked.message,
        });
        return;
      }

      const stationId = peeked.record.stationId;
      const connectorId = peeked.record.connectorId;

      this.loadManager.registerStation(stationId, this.loadManager.getDefaultMaxPower());

      const existing = this.pricingService.findActiveSession(stationId, connectorId);
      if (existing) {
        res.status(409).json({
          success: false,
          message: 'An active session already exists for this station/connector',
          data: { sessionId: existing.id },
        });
        return;
      }

      const startMeterValue =
        req.query.meterValue !== undefined ? Number(req.query.meterValue) : 0;
      if (!Number.isFinite(startMeterValue) || startMeterValue < 0) {
        res.status(400).json({
          success: false,
          message: 'meterValue query param must be a non-negative number when provided',
        });
        return;
      }

      if (!this.loadManager.isWebSocketOpen()) {
        res.status(503).json({
          success: false,
          message: 'CitrineOS WebSocket is not connected; charging start was not sent',
        });
        return;
      }

      const resolved = this.tokenStore.resolveAndConsume(token, 'start');
      if (!resolved.ok) {
        res.status(this.statusForResolveError(resolved.code)).json({
          success: false,
          code: resolved.code,
          message: resolved.message,
        });
        return;
      }

      const { record } = resolved;

      let sessionId: string;
      try {
        sessionId = this.pricingService.startSession(stationId, connectorId, startMeterValue, {
          customerId: record.customerId,
          locationId: record.locationId,
          source: 'deeplink',
          deepLinkToken: record.token,
        });
      } catch (error) {
        this.tokenStore.releaseUse(token);
        throw error;
      }

      const sent = this.loadManager.sendRemoteStart(stationId, connectorId, {
        idTag: record.idTag || record.customerId || `dl-${record.token.slice(0, 20)}`,
      });

      if (!sent) {
        try {
          this.pricingService.cancelSession(sessionId, 'remote_start_not_delivered');
        } catch {
          // ignore
        }
        this.tokenStore.releaseUse(token);
        res.status(503).json({
          success: false,
          message: 'CitrineOS WebSocket is not connected; charging start was not sent',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Charging start command sent',
        data: {
          sessionId,
          stationId,
          connectorId,
          tokenUsesRemaining: Math.max(0, record.maxUses - record.useCount),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/deep-link/stop/:token
   */
  public async stopCharging(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      if (!token) {
        res.status(400).json({ success: false, message: 'Missing token' });
        return;
      }

      const peeked = this.tokenStore.peek(token, 'stop');
      if (!peeked.ok) {
        res.status(this.statusForResolveError(peeked.code)).json({
          success: false,
          code: peeked.code,
          message: peeked.message,
        });
        return;
      }

      const stationId = peeked.record.stationId;
      const connectorId = peeked.record.connectorId;

      const openSession = this.pricingService.findOpenSession(stationId, connectorId);
      const endMeterValue =
        req.query.meterValue !== undefined ? Number(req.query.meterValue) : undefined;

      if (endMeterValue !== undefined && (!Number.isFinite(endMeterValue) || endMeterValue < 0)) {
        res.status(400).json({
          success: false,
          message: 'meterValue query param must be a non-negative number when provided',
        });
        return;
      }

      if (!this.loadManager.isWebSocketOpen()) {
        res.status(503).json({
          success: false,
          message: 'CitrineOS WebSocket is not connected; stop command was not sent',
          data: {
            sessionId: openSession?.id,
            sessionEndedLocally: false,
          },
        });
        return;
      }

      const resolved = this.tokenStore.resolveAndConsume(token, 'stop');
      if (!resolved.ok) {
        res.status(this.statusForResolveError(resolved.code)).json({
          success: false,
          code: resolved.code,
          message: resolved.message,
        });
        return;
      }

      const { record } = resolved;
      const transactionId = openSession
        ? this.pricingService.getSessionTransactionId(openSession.id)
        : undefined;

      const sent = this.loadManager.sendRemoteStop(stationId, connectorId, {
        transactionId: transactionId ?? undefined,
      });

      if (!sent) {
        this.tokenStore.releaseUse(token);
        res.status(503).json({
          success: false,
          message: 'CitrineOS WebSocket is not connected; stop command was not sent',
          data: {
            sessionId: openSession?.id,
            sessionEndedLocally: false,
          },
        });
        return;
      }

      // Only end local pricing session after remote stop was accepted for delivery.
      // Idle sessions (OCPP already stopped) must finalize idle fee — do not leave them open.
      let completedSession: ChargingSession | null = null;
      if (openSession && openSession.status === 'active') {
        const meter =
          endMeterValue !== undefined && Number.isFinite(endMeterValue)
            ? endMeterValue
            : openSession.endMeterValue ?? openSession.startMeterValue;
        completedSession = this.pricingService.endSession(openSession.id, meter);
      } else if (openSession && openSession.status === 'idle') {
        completedSession = this.pricingService.endIdleTracking(openSession.id);
      }

      res.status(200).json({
        success: true,
        message: 'Charging stop command sent',
        data: {
          stationId,
          connectorId,
          sessionId: completedSession?.id ?? openSession?.id,
          session: completedSession,
          tokenUsesRemaining: Math.max(0, record.maxUses - record.useCount),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private statusForResolveError(
    code: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED' | 'PURPOSE_MISMATCH'
  ): number {
    switch (code) {
      case 'NOT_FOUND':
        return 404;
      case 'REVOKED':
      case 'EXPIRED':
      case 'EXHAUSTED':
      case 'PURPOSE_MISMATCH':
        return 410;
      default:
        return 400;
    }
  }
}
