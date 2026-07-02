import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { initDb } from './db.mjs';
import { getBindHost, getCorsOptions, createRateLimiter } from './security.mjs';
import { seedDemoUser } from './services/seed.mjs';
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

const PORT = Number(process.env.BC_SERVER_PORT ?? process.env.STRIPE_SERVER_PORT ?? 4242);

const app = express();
app.disable('x-powered-by');

const corsOptions = getCorsOptions();
app.use(
  cors({
    ...corsOptions,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(createRateLimiter({ windowMs: 60_000, max: 300 }));

await initDb();
await seedDemoUser();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bc-charge-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/citrineos', citrineosRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/adhoc', adhocRouter);
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhooksRouter
);

app.use((err, _req, res, next) => {
  if (err?.message === 'CORS blockiert') {
    res.status(403).json({ error: 'Origin nicht erlaubt' });
    return;
  }
  next(err);
});

const host = getBindHost();
app.listen(PORT, host, () => {
  const dbClient = (process.env.BC_DB_CLIENT ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();
  console.log(`[bc-charge] API http://${host}:${PORT}`);
  console.log(`[bc-charge] Datenbankmodus: ${dbClient}`);
  if (!process.env.BC_JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('[bc-charge] BC_JWT_SECRET fehlt – setzen Sie einen langen Zufallswert.');
  }
  if (!process.env.CITRINEOS_API_URL) {
    console.log('[bc-charge] CitrineOS nicht konfiguriert – Stationsdaten bleiben statisch bis Setup.');
  }
});

export default app;
