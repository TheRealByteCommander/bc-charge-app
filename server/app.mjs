import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { initDb } from './db.mjs';
import { getBindHost, getCorsOptions, createRateLimiter } from './security.mjs';
import { attachUserForRateLimit } from './middleware/auth.mjs';
import { errorHandlerMiddleware } from './middleware/errorHandler.mjs';
import { seedDemoUser } from './services/seed.mjs';
import { initConfigTable } from './services/configService.mjs';
import { logger } from './utils/logger.mjs';
import authRouter from './routes/auth.mjs';
import profileRouter from './routes/profile.mjs';
import sessionsRouter from './routes/sessions.mjs';
import stripeRouter from './routes/stripe.mjs';
import citrineosRouter from './routes/citrineos.mjs';
import invoicesRouter from './routes/invoices.mjs';
import webhooksRouter from './routes/webhooks.mjs';
import gamificationRouter from './routes/gamification.mjs';
import adhocRouter from './routes/adhoc.mjs';
import rewardsRouter from './routes/rewards.mjs';
import adminConfigRouter from './routes/adminConfig.mjs';
import citrineosWebhooksRouter from './routes/citrineosWebhooks.mjs';
import loadManagementRouter from './routes/loadManagement.mjs';
import priceOptimizationRouter from './routes/priceOptimization.mjs';
import pvSurplusChargingRouter from './routes/pvSurplusCharging.mjs';
import pricingRouter from './routes/pricing.mjs';

const PORT = Number(process.env.BC_SERVER_PORT ?? process.env.STRIPE_SERVER_PORT ?? 4242);

const app = express();
app.disable('x-powered-by');
/** Hinter Nginx/Caddy: echte Client-IP für Rate-Limit-Fallback (nicht nur 127.0.0.1). */
app.set('trust proxy', Number(process.env.BC_TRUST_PROXY_HOPS ?? 1));

const corsOptions = getCorsOptions();
app.use(
  cors({
    ...corsOptions,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bc-charge-api' });
});

app.use(attachUserForRateLimit);
app.use(createRateLimiter({ windowMs: 60_000, max: 900 }));

await initDb();
await initConfigTable();
await seedDemoUser();

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/citrineos', citrineosRouter);
app.use('/api/price-optimization', priceOptimizationRouter);
app.use('/api/pv-surplus', pvSurplusChargingRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/adhoc', adhocRouter);
app.use('/api/admin/config', adminConfigRouter);
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhooksRouter
);
app.use('/api/webhooks/citrineos', citrineosWebhooksRouter);
app.use('/api/load-management', loadManagementRouter);

app.use((err, _req, res, next) => {
  if (err?.message === 'CORS blockiert') {
    res.status(403).json({ error: 'Origin nicht erlaubt' });
    return;
  }
  next(err);
});

app.use(errorHandlerMiddleware);

const host = getBindHost();
app.listen(PORT, host, () => {
  const dbClient = (process.env.BC_DB_CLIENT ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();
  logger.info(`API http://${host}:${PORT}`);
  logger.info(`Datenbankmodus: ${dbClient}`);
  if (!process.env.BC_JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.warn('BC_JWT_SECRET fehlt – setzen Sie einen langen Zufallswert.');
  }
  if (!process.env.CITRINEOS_API_URL) {
    logger.info('CitrineOS nicht konfiguriert – Stationsdaten bleiben statisch bis Setup.');
  }
});

export default app;
