import express from 'express';
import { LoadManager } from './services/LoadManager';
import { BillingService, PaymentMethod } from './services/BillingService';
import { setLoadManager, setPricingService, buildHealthSnapshot } from './health';
import { PvSurplusService, PvSurplusController } from './services/pv-surplus';
import { PricingService, PricingController } from './services/pricing';
import { HealthCheckBot } from './services/HealthCheckBot';
import { DeepLinkController } from './services/DeepLinkController';
import { DeepLinkTokenStore } from './services/DeepLinkTokenStore';

/**
 * Main entry point for the Dynamic Load Management service.
 *
 * Connects to CitrineOS, manages charging loads, pricing, deep-links,
 * health checks and billing export.
 */

const CONFIG = {
  maxSitePower: parseInt(process.env.MAX_SITE_POWER || '50', 10),
  adjustmentThreshold: parseInt(process.env.ADJUSTMENT_THRESHOLD || '5', 10),
  adjustmentDelay: parseInt(process.env.ADJUSTMENT_DELAY || '1000', 10),
  monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '5000', 10),
  citrineWsUrl: process.env.CITRINE_WS_URL || 'ws://localhost:8080',
  defaultStationMaxPowerKw: parseFloat(process.env.DEFAULT_STATION_MAX_POWER_KW || '22'),
};

const PRICING_CONFIG = {
  defaultPricePerKwh: parseFloat(process.env.PRICING_DEFAULT_PRICE_PER_KWH || '0.30'),
  defaultIdleFeePerMin: parseFloat(process.env.PRICING_DEFAULT_IDLE_FEE_PER_MIN || '0.05'),
  currency: process.env.PRICING_CURRENCY || 'EUR',
  timezone: process.env.PRICING_TIMEZONE || 'Europe/Berlin',
};

const KNOWN_STATIONS = (process.env.KNOWN_STATIONS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (
  Number.isNaN(CONFIG.maxSitePower) ||
  Number.isNaN(CONFIG.adjustmentThreshold) ||
  Number.isNaN(CONFIG.adjustmentDelay) ||
  Number.isNaN(CONFIG.monitoringInterval) ||
  Number.isNaN(CONFIG.defaultStationMaxPowerKw)
) {
  console.error('Invalid configuration: numeric values expected');
  process.exit(1);
}

console.log('Starting Dynamic Load Management service with configuration:');
console.log(`- Max Site Power: ${CONFIG.maxSitePower}kW`);
console.log(`- Adjustment Threshold: ${CONFIG.adjustmentThreshold}kW`);
console.log(`- Adjustment Delay: ${CONFIG.adjustmentDelay}ms`);
console.log(`- Monitoring Interval: ${CONFIG.monitoringInterval}ms`);
console.log(`- CitrineOS WebSocket URL: ${CONFIG.citrineWsUrl}`);
console.log(`- Known stations (bootstrap): ${KNOWN_STATIONS.length ? KNOWN_STATIONS.join(', ') : '(none — discovered via OCPP)'}`);

const loadManager = new LoadManager(
  CONFIG,
  CONFIG.citrineWsUrl,
  CONFIG.defaultStationMaxPowerKw
);

const deepLinkTokenStore = new DeepLinkTokenStore();
// Periodic prune of expired/revoked tokens
const tokenPruneTimer = setInterval(() => {
  try {
    const removed = deepLinkTokenStore.prune();
    if (removed > 0) {
      console.log(`DeepLinkTokenStore pruned ${removed} token(s)`);
    }
  } catch (error) {
    console.error('DeepLinkTokenStore prune failed:', error);
  }
}, 60 * 60 * 1000);

const healthBot = new HealthCheckBot({
  citrineWsUrl: CONFIG.citrineWsUrl,
  checkIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || String(5 * 60 * 1000), 10),
  responseTimeoutMs: parseInt(process.env.HEALTH_RESPONSE_TIMEOUT_MS || '30000', 10),
  failureThreshold: parseInt(process.env.HEALTH_FAILURE_THRESHOLD || '3', 10),
  resetCooldownMs: parseInt(process.env.HEALTH_RESET_COOLDOWN_MS || String(30 * 60 * 1000), 10),
  getStationIds: () => {
    const live = loadManager.getStationIds();
    if (live.length > 0) {
      return live;
    }
    return KNOWN_STATIONS;
  },
});

const pvSurplusService = new PvSurplusService(console, { loadManager });
const pricingService = new PricingService(PRICING_CONFIG, console);
const billingService = new BillingService();
const deepLinkController = new DeepLinkController(
  loadManager,
  pricingService,
  deepLinkTokenStore
);

const apiApp = express();
const API_PORT = Number(process.env.PRICING_API_PORT || process.env.API_PORT || 3003);

apiApp.use(express.json());

const pvSurplusController = new PvSurplusController(pvSurplusService, console);
const pricingController = new PricingController(pricingService, console);

// PV Surplus
apiApp.post('/api/pv-surplus', (req, res, next) => pvSurplusController.updateSurplus(req, res, next));
apiApp.get('/api/pv-surplus', (req, res, next) => pvSurplusController.getSurplus(req, res, next));

// Pricing
apiApp.post('/api/pricing/tariff', (req, res, next) => pricingController.addTariffPeriod(req, res, next));
apiApp.get('/api/pricing/tariff', (req, res, next) => pricingController.getTariffPeriods(req, res, next));
apiApp.post('/api/pricing/session/start', (req, res, next) => pricingController.startSession(req, res, next));
apiApp.post('/api/pricing/session/end', (req, res, next) => pricingController.endSession(req, res, next));
apiApp.post('/api/pricing/session/idle/start', (req, res, next) => pricingController.startIdleTracking(req, res, next));
apiApp.post('/api/pricing/session/idle/end', (req, res, next) => pricingController.endIdleTracking(req, res, next));
apiApp.get('/api/pricing/session/:sessionId', (req, res, next) => pricingController.getSession(req, res, next));
apiApp.post('/api/pricing/energy-price', (req, res, next) => pricingController.updateEnergyPrice(req, res, next));
apiApp.get('/api/pricing/config', (req, res, next) => pricingController.getConfig(req, res, next));

// Deep-Link
apiApp.post('/api/deep-link/tokens', (req, res, next) => deepLinkController.createToken(req, res, next));
apiApp.get('/api/deep-link/tokens', (req, res, next) => deepLinkController.listTokens(req, res, next));
apiApp.delete('/api/deep-link/tokens/:token', (req, res, next) => deepLinkController.revokeToken(req, res, next));
apiApp.get('/api/deep-link/start/:token', (req, res, next) => deepLinkController.startCharging(req, res, next));
apiApp.get('/api/deep-link/stop/:token', (req, res, next) => deepLinkController.stopCharging(req, res, next));

// Load / stations
apiApp.get('/api/stations', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      stations: loadManager.getStations(),
      wsOpen: loadManager.isWebSocketOpen(),
    },
  });
});

apiApp.get('/api/health/stations', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      stations: healthBot.getAllHealth(),
    },
  });
});

// Billing export
apiApp.post('/api/billing/export', async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const sessionIds: string[] | undefined = Array.isArray(body.sessionIds)
      ? body.sessionIds.filter((id: unknown) => typeof id === 'string')
      : undefined;
    const filename =
      typeof body.filename === 'string' && body.filename.trim()
        ? body.filename.trim()
        : undefined;
    const paymentMethodDefault: PaymentMethod =
      body.paymentMethod === 'stripe' ||
      body.paymentMethod === 'rfid' ||
      body.paymentMethod === 'guest' ||
      body.paymentMethod === 'deeplink' ||
      body.paymentMethod === 'unknown'
        ? body.paymentMethod
        : 'unknown';

    const sessions = sessionIds?.length
      ? sessionIds
          .map((id) => pricingService.getSession(id))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
      : pricingService.getBillableSessions();

    if (sessions.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No billable sessions found to export',
      });
      return;
    }

    const transactions = sessions.map((session) => {
      const method: PaymentMethod =
        session.source === 'deeplink'
          ? 'deeplink'
          : paymentMethodDefault;
      return billingService.fromChargingSession(session, {
        customerId: session.customerId,
        locationId: session.locationId,
        paymentMethod: method,
        currency: PRICING_CONFIG.currency,
      });
    });

    const path = await billingService.exportToCsv(transactions, filename);
    res.status(200).json({
      success: true,
      data: {
        path,
        count: transactions.length,
        exportDir: billingService.getExportDir(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Error handler
apiApp.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('API error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ success: false, message });
  }
);

setLoadManager(loadManager);
setPricingService(pricingService);

const healthApp = express();
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 3001);

healthApp.get('/health', (_req, res) => {
  const snap = buildHealthSnapshot();
  res.status(200).json({
    status: snap.status,
    timestamp: snap.timestamp,
    service: snap.service,
    wsOpen: snap.wsOpen,
  });
});

healthApp.get('/health/detailed', (_req, res) => {
  const snap = buildHealthSnapshot();
  res.status(200).json({
    ...snap,
    stationHealth: healthBot.getAllHealth(),
    pvSurplusKw: pvSurplusService.getCurrentSurplus(),
  });
});

const healthServer = healthApp.listen(HEALTH_PORT, () => {
  console.log(`Health check server running on port ${HEALTH_PORT}`);
});

const apiServer = apiApp.listen(API_PORT, () => {
  console.log(`API server running on port ${API_PORT}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  clearInterval(tokenPruneTimer);
  loadManager.shutdown();
  healthBot.shutdown();
  healthServer.close();
  apiServer.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function main(): Promise<void> {
  try {
    await loadManager.initialize();

    for (const stationId of KNOWN_STATIONS) {
      loadManager.registerStation(stationId, CONFIG.defaultStationMaxPowerKw);
    }

    await healthBot.initialize(KNOWN_STATIONS.length ? KNOWN_STATIONS : loadManager.getStationIds());

    loadManager.on(
      'transactionStarted',
      ({
        stationId,
        connectorId,
        meterStart,
        idTag,
      }: {
        stationId: string;
        connectorId: number;
        meterStart?: number;
        idTag?: string;
      }) => {
        try {
          const existing = pricingService.findActiveSession(stationId, connectorId);
          if (existing) {
            console.log(
              `OCPP start for ${stationId}/${connectorId}: session ${existing.id} already active`
            );
            return;
          }
          const sessionId = pricingService.startSession(
            stationId,
            connectorId,
            Number.isFinite(meterStart) ? (meterStart as number) : 0,
            {
              customerId: idTag,
              source: 'ocpp',
            }
          );
          console.log(`OCPP start: created pricing session ${sessionId} for ${stationId}/${connectorId}`);
        } catch (error) {
          console.error('Failed to create session on transactionStarted:', error);
        }
      }
    );

    loadManager.on(
      'transactionStopped',
      ({
        stationId,
        connectorId,
        meterStop,
      }: {
        stationId: string;
        connectorId: number;
        meterStop?: number;
      }) => {
        console.log(`Handling transaction stop for ${stationId}, connector ${connectorId}`);

        const session =
          pricingService.findActiveSession(stationId, connectorId) ||
          pricingService.findOpenSession(stationId, connectorId);

        if (!session) {
          console.warn(
            `No open session found for station ${stationId}, connector ${connectorId} to start idle tracking`
          );
          return;
        }

        try {
          pricingService.startIdleTracking(
            session.id,
            meterStop !== undefined && Number.isFinite(meterStop) ? meterStop : undefined
          );
          console.log(`Idle tracking started for session ${session.id}`);
        } catch (error) {
          console.error(`Failed to start idle tracking for session ${session.id}:`, error);
        }
      }
    );

    console.log('Dynamic Load Management service is running...');
  } catch (error) {
    console.error('Failed to initialize LoadManager:', error);
    process.exit(1);
  }
}

void main();
