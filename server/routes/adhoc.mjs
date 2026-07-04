import { Router } from 'express';
import Stripe from 'stripe';
import { createRateLimiter } from '../security.mjs';
import { validateSessionCost } from '../services/chargeValidation.mjs';
import {
  createAccessToken,
  createAdhocIdToken,
  createAdhocSessionId,
} from '../services/adhocSessions.mjs';
import {
  fetchTransactionById,
  fetchTransactionByRemoteStartId,
  isCitrineosConfigured,
  resolveAdhocConnector,
  startAdhocTransaction,
  stopAdhocTransaction,
} from '../services/citrineosServer.mjs';
import { isConnectorStartable } from '../utils/ocppStatus.mjs';
import { findAdhocSession, insertAdhocSession, updateAdhocSession } from '../db.mjs';

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const adhocLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
const adhocMutateLimiter = createRateLimiter({ windowMs: 60_000, max: 15 });

const PREAUTH_CENTS = Math.min(
  25_000,
  Math.max(500, Number(process.env.BC_ADHOC_PREAUTH_CENTS ?? 5000))
);
const ADHOC_ENABLED = process.env.BC_ADHOC_ENABLED !== 'false';

function requireAdhocEnabled(_req, res, next) {
  if (!ADHOC_ENABLED) {
    res.status(503).json({ error: 'Ad-Hoc-Laden ist derzeit nicht verfügbar.' });
    return;
  }
  next();
}

function requireStripe(res) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).' });
    return null;
  }
  return stripe;
}

function handleError(res, err) {
  const status = err.status ?? 500;
  const message = err instanceof Error ? err.message : 'Interner Fehler';
  res.status(status).json({ error: message });
}

function computeCostEur(energyKwh, connector, minutes = 0) {
  const kwh = Number(energyKwh) || 0;
  const min = Number(minutes) || 0;
  const energy = kwh * (connector.pricePerKwh ?? 0.49);
  const time = min * (connector.pricePerMin ?? 0);
  const fee = connector.sessionFee ?? 0;
  return Math.round((energy + time + fee) * 100) / 100;
}

router.use(requireAdhocEnabled);
router.use(adhocLimiter);

router.get('/health', (_req, res) => {
  res.json({
    ok: ADHOC_ENABLED && Boolean(stripe) && isCitrineosConfigured(),
    stripe: Boolean(stripe),
    citrineos: isCitrineosConfigured(),
    preAuthCents: PREAUTH_CENTS,
  });
});

router.post('/quote', async (req, res) => {
  const { stationId, connectorId } = req.body ?? {};
  if (!stationId || !connectorId) {
    res.status(400).json({ error: 'stationId und connectorId erforderlich' });
    return;
  }

  try {
    if (!isCitrineosConfigured()) {
      res.status(503).json({ error: 'CitrineOS nicht konfiguriert' });
      return;
    }
    const resolved = await resolveAdhocConnector(String(stationId), String(connectorId));
    if (!resolved.isOnline && !isConnectorStartable(resolved.connector.status, resolved.connector.ocppRawStatus)) {
      res.status(409).json({ error: 'Station ist derzeit offline' });
      return;
    }
    if (!isConnectorStartable(resolved.connector.status, resolved.connector.ocppRawStatus)) {
      res.status(409).json({ error: 'Anschluss ist derzeit nicht verfügbar' });
      return;
    }

    res.json({
      stationId: resolved.stationId,
      stationName: resolved.stationName,
      address: resolved.address,
      connector: {
        id: resolved.connector.id,
        type: resolved.connector.type,
        powerKw: resolved.connector.powerKw,
        pricePerKwh: resolved.connector.pricePerKwh,
        sessionFee: resolved.connector.sessionFee,
        pricePerMin: resolved.connector.pricePerMin,
      },
      preAuthCents: PREAUTH_CENTS,
      preAuthEur: PREAUTH_CENTS / 100,
      currency: resolved.connector.currency ?? 'eur',
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/prepare-payment', adhocMutateLimiter, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { stationId, connectorId, email } = req.body ?? {};
  if (!stationId || !connectorId) {
    res.status(400).json({ error: 'stationId und connectorId erforderlich' });
    return;
  }

  try {
    const resolved = await resolveAdhocConnector(String(stationId), String(connectorId));
    if (!isConnectorStartable(resolved.connector.status, resolved.connector.ocppRawStatus)) {
      res.status(409).json({ error: 'Anschluss ist derzeit nicht verfügbar' });
      return;
    }

    const sessionId = createAdhocSessionId();
    const accessToken = createAccessToken();

    const intent = await s.paymentIntents.create({
      amount: PREAUTH_CENTS,
      currency: resolved.connector.currency ?? 'eur',
      capture_method: 'manual',
      payment_method_types: ['card'],
      receipt_email: typeof email === 'string' && email.includes('@') ? email.slice(0, 254) : undefined,
      description: `BC Charge Ad-Hoc – ${resolved.stationName}`,
      metadata: {
        source: 'bc-charge-adhoc',
        sessionId,
        stationId: resolved.stationId,
        connectorId: resolved.connector.id,
      },
    });

    const session = {
      id: sessionId,
      accessToken,
      stationId: resolved.stationId,
      stationName: resolved.stationName,
      address: resolved.address,
      connectorId: resolved.connector.id,
      connectorType: resolved.connector.type,
      powerKw: resolved.connector.powerKw,
      pricePerKwh: resolved.connector.pricePerKwh,
      sessionFee: resolved.connector.sessionFee,
      pricePerMin: resolved.connector.pricePerMin,
      status: 'payment_pending',
      paymentIntentId: intent.id,
      preAuthCents: PREAUTH_CENTS,
      energyKwh: 0,
      costEur: resolved.connector.sessionFee ?? 0,
      startedAt: null,
      email: typeof email === 'string' ? email.slice(0, 254) : undefined,
    };

    await insertAdhocSession(session);

    res.json({
      sessionId,
      accessToken,
      clientSecret: intent.client_secret,
      preAuthCents: PREAUTH_CENTS,
    });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/start', adhocMutateLimiter, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { sessionId, accessToken } = req.body ?? {};
  if (!sessionId || !accessToken) {
    res.status(400).json({ error: 'sessionId und accessToken erforderlich' });
    return;
  }

  try {
    const session = await findAdhocSession(String(sessionId), String(accessToken));
    if (!session) {
      res.status(404).json({ error: 'Sitzung nicht gefunden' });
      return;
    }
    if (session.status === 'active') {
      res.json({ session });
      return;
    }
    if (session.status !== 'payment_pending') {
      res.status(409).json({ error: 'Sitzung kann nicht gestartet werden' });
      return;
    }

    const intent = await s.paymentIntents.retrieve(session.paymentIntentId);
    if (intent.status !== 'requires_capture' && intent.status !== 'succeeded') {
      res.status(402).json({ error: 'Zahlung nicht autorisiert' });
      return;
    }
    if (intent.metadata?.sessionId !== session.id) {
      res.status(403).json({ error: 'Zahlungszuordnung ungültig' });
      return;
    }

    const resolved = await resolveAdhocConnector(session.stationId, session.connectorId);
    if (!isConnectorStartable(resolved.connector.status, resolved.connector.ocppRawStatus)) {
      res.status(409).json({ error: 'Anschluss ist derzeit nicht verfügbar' });
      return;
    }

    const idToken = createAdhocIdToken(session.id);
    const { remoteStartId, transactionId } = await startAdhocTransaction(
      session.stationId,
      resolved.connector.evseId,
      idToken
    );

    const updated = {
      ...session,
      status: 'active',
      idToken,
      remoteStartId,
      citrineosTransactionId: transactionId,
      startedAt: new Date().toISOString(),
    };
    await updateAdhocSession(updated);

    res.json({ session: updated });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/session/:id', async (req, res) => {
  const accessToken = req.get('x-adhoc-token') ?? req.query.token;
  if (!accessToken) {
    res.status(400).json({ error: 'accessToken erforderlich' });
    return;
  }

  try {
    const session = await findAdhocSession(req.params.id, String(accessToken));
    if (!session) {
      res.status(404).json({ error: 'Sitzung nicht gefunden' });
      return;
    }

    if (session.status !== 'active') {
      res.json({ session });
      return;
    }

    let tx = null;
    if (session.citrineosTransactionId) {
      tx = await fetchTransactionById(session.stationId, session.citrineosTransactionId);
    } else if (session.remoteStartId != null) {
      tx = await fetchTransactionByRemoteStartId(session.stationId, session.remoteStartId);
    }

    if (tx) {
      const energyKwh = Number(tx.totalKwh ?? session.energyKwh) || 0;
      const costEur =
        tx.totalCost != null
          ? Number(tx.totalCost)
          : computeCostEur(energyKwh, session, 0);
      const updated = {
        ...session,
        energyKwh,
        costEur,
        citrineosTransactionId: tx.transactionId ?? session.citrineosTransactionId,
        chargingState: tx.chargingState ?? session.chargingState,
        isActive: tx.isActive ?? true,
      };
      await updateAdhocSession(updated);
      res.json({ session: updated });
      return;
    }

    res.json({ session });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/stop', adhocMutateLimiter, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { sessionId, accessToken } = req.body ?? {};
  if (!sessionId || !accessToken) {
    res.status(400).json({ error: 'sessionId und accessToken erforderlich' });
    return;
  }

  try {
    const session = await findAdhocSession(String(sessionId), String(accessToken));
    if (!session) {
      res.status(404).json({ error: 'Sitzung nicht gefunden' });
      return;
    }
    if (session.status === 'completed') {
      res.json({ session });
      return;
    }
    if (session.status !== 'active') {
      res.status(409).json({ error: 'Keine aktive Sitzung' });
      return;
    }

    if (session.citrineosTransactionId) {
      await stopAdhocTransaction(session.stationId, session.citrineosTransactionId);
      await new Promise((r) => setTimeout(r, 2000));
    }

    let tx = null;
    if (session.citrineosTransactionId) {
      tx = await fetchTransactionById(session.stationId, session.citrineosTransactionId);
    } else if (session.remoteStartId != null) {
      tx = await fetchTransactionByRemoteStartId(session.stationId, session.remoteStartId);
    }

    const energyKwh = Number(tx?.totalKwh ?? session.energyKwh) || 0;
    const costEur =
      tx?.totalCost != null ? Number(tx.totalCost) : computeCostEur(energyKwh, session, 0);

    const costError = validateSessionCost({
      energyKwh,
      costEur,
      pricePerKwh: session.pricePerKwh ?? 0.49,
      sessionFee: session.sessionFee ?? 0,
    });
    if (costError && energyKwh > 0.1) {
      res.status(400).json({ error: costError });
      return;
    }

    const captureCents = Math.min(
      PREAUTH_CENTS,
      Math.max(50, Math.round(costEur * 100))
    );

    let paymentStatus = 'skipped';
    try {
      const intent = await s.paymentIntents.capture(session.paymentIntentId, {
        amount_to_capture: captureCents,
      });
      paymentStatus = intent.status === 'succeeded' ? 'paid' : 'pending';
    } catch (captureErr) {
      if (captureCents <= 50) {
        await s.paymentIntents.cancel(session.paymentIntentId);
        paymentStatus = 'cancelled';
      } else {
        throw captureErr;
      }
    }

    const updated = {
      ...session,
      status: 'completed',
      energyKwh,
      costEur,
      captureCents,
      paymentStatus,
      endedAt: new Date().toISOString(),
      citrineosTransactionId: tx?.transactionId ?? session.citrineosTransactionId,
      chargingState: tx?.chargingState ?? session.chargingState,
    };
    await updateAdhocSession(updated);

    res.json({ session: updated });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
