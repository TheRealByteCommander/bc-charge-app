import { Router } from 'express';
import {
  findUserById,
  listSessions,
  replaceSessions,
  rowToProfile,
  updateUserProfile,
  upsertSession,
  listFulfillments,
  getFulfillmentById,
  markFulfillmentUsed,
} from '../db.mjs';
import { requireAuth } from '../middleware/auth.mjs';
import { validateSessionCost } from '../services/chargeValidation.mjs';
import { issueInvoiceForSession } from '../services/invoices.mjs';
import { applySessionStats } from '../services/loyalty.mjs';
import {
  applyChargingFulfillment,
  getNightPointsMultiplier,
  isFulfillmentActive,
  shouldConsumeFulfillment,
} from '../services/rewardFulfillment.mjs';
import { syncAccountSessionFromCitrineos, stopAndSyncAccountSession } from '../services/citrineosServer.mjs';

const router = Router();

async function listSessionsWithLiveSync(userId) {
  const sessions = await listSessions(userId);
  const activeIdx = sessions.findIndex((s) => s.status === 'active');
  if (activeIdx < 0) return sessions;

  const synced = await syncAccountSessionFromCitrineos(sessions[activeIdx]);
  if (JSON.stringify(synced) === JSON.stringify(sessions[activeIdx])) {
    return sessions;
  }

  await upsertSession(userId, synced);
  const next = [...sessions];
  next[activeIdx] = synced;
  return next;
}

function handleSessionError(res, err) {
  const status = err?.status ?? 500;
  const body = { error: err instanceof Error ? err.message : 'Interner Fehler' };
  if (err?.code) body.code = err.code;
  if (err?.activeSession) body.activeSession = err.activeSession;
  res.status(status).json(body);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const live = req.query.sync === '1' || req.query.sync === 'true';
    const sessions = live
      ? await listSessionsWithLiveSync(req.userId)
      : await listSessions(req.userId);
    res.json({ sessions });
  } catch (err) {
    handleSessionError(res, err);
  }
});

/** Aktive Sitzung ohne CitrineOS-Sync (leichtgewichtig für Ladestart-Check). */
router.get('/active', requireAuth, async (req, res) => {
  try {
    const sessions = await listSessions(req.userId);
    const active = sessions.find((s) => s.status === 'active') ?? null;
    res.json({ session: active });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.get('/active/sync', requireAuth, async (req, res) => {
  try {
    const sessions = await listSessions(req.userId);
    const active = sessions.find((s) => s.status === 'active');
    if (!active) {
      res.json({ session: null });
      return;
    }

    const synced = await syncAccountSessionFromCitrineos(active);
    if (JSON.stringify(synced) !== JSON.stringify(active)) {
      await upsertSession(req.userId, synced);
    }
    res.json({ session: synced });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.post('/active/stop-remote', requireAuth, async (req, res) => {
  try {
    const sessions = await listSessions(req.userId);
    const active = sessions.find((s) => s.status === 'active');
    if (!active) {
      res.status(404).json({ error: 'Keine aktive Sitzung.' });
      return;
    }

    const synced = await stopAndSyncAccountSession(active);
    await upsertSession(req.userId, synced);
    res.json({ session: synced });
  } catch (err) {
    handleSessionError(res, err);
  }
});

/** Hängende Sitzung beenden (z. B. wenn Remote-Stop fehlschlägt oder Säule offline). */
router.post('/active/abandon', requireAuth, async (req, res) => {
  try {
    const sessions = await listSessions(req.userId);
    let active = sessions.find((s) => s.status === 'active');
    if (!active) {
      res.status(404).json({ error: 'Keine aktive Sitzung.' });
      return;
    }

    active = await syncAccountSessionFromCitrineos(active);

    if (active.citrineosTransactionId && active.citrineosTxActive !== false) {
      try {
        active = await stopAndSyncAccountSession(active);
      } catch (e) {
        console.warn('[bc-charge] Stop vor Abandon fehlgeschlagen:', e);
      }
    }

    const completed = {
      ...active,
      status: 'completed',
      endedAt: new Date().toISOString(),
      paymentStatus: active.costEur >= 0.5 ? active.paymentStatus ?? 'skipped' : 'skipped',
    };

    await upsertSession(req.userId, completed);
    res.json({ session: completed, abandoned: true });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.put('/', requireAuth, async (req, res) => {
  const { sessions } = req.body ?? {};
  if (!Array.isArray(sessions)) {
    res.status(400).json({ error: 'sessions muss ein Array sein.' });
    return;
  }
  try {
    await replaceSessions(req.userId, sessions);
    res.json({ sessions: await listSessions(req.userId) });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id) {
    res.status(400).json({ error: 'session mit id erforderlich.' });
    return;
  }
  try {
    await upsertSession(req.userId, session);
    res.status(201).json({ session });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id || session.id !== req.params.id) {
    res.status(400).json({ error: 'Ungültige Sitzungsdaten.' });
    return;
  }
  try {
    await upsertSession(req.userId, session);
    res.json({ session });
  } catch (err) {
    handleSessionError(res, err);
  }
});

router.post('/:id/complete', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id || session.id !== req.params.id) {
    res.status(400).json({ error: 'Ungültige Sitzungsdaten.' });
    return;
  }

  const minutes =
    session.endedAt && session.startedAt
      ? (new Date(session.endedAt) - new Date(session.startedAt)) / 60000
      : 0;

  let baseCostEur = session.baseCostEur;
  let rewardDiscountEur = session.rewardDiscountEur ?? 0;
  let costEur = session.costEur;

  if (session.appliedFulfillmentId) {
    const fulfillment = await getFulfillmentById(req.userId, session.appliedFulfillmentId);
    if (!fulfillment || !isFulfillmentActive(fulfillment)) {
      res.status(400).json({ error: 'Die gewählte Prämie ist nicht mehr gültig.' });
      return;
    }
    const applied = applyChargingFulfillment({
      energyKwh: session.energyKwh,
      pricePerKwh: session.pricePerKwh,
      sessionFee: session.sessionFee,
      pricePerMin: session.pricePerMin,
      minutes,
      fulfillment,
    });
    baseCostEur = applied.baseCostEur;
    rewardDiscountEur = applied.rewardDiscountEur;
    costEur = applied.costEur;
  }

  const costError = validateSessionCost({
    energyKwh: session.energyKwh,
    costEur,
    pricePerKwh: session.pricePerKwh,
    sessionFee: session.sessionFee,
    minutes,
    baseCostEur,
    rewardDiscountEur,
  });
  if (costError) {
    res.status(400).json({ error: costError });
    return;
  }

  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden.' });
    return;
  }

  const profile = rowToProfile(row);
  const gamificationPatch = req.body?.gamification;
  const fulfillments = await listFulfillments(req.userId);
  const nightPointsMultiplier = getNightPointsMultiplier(fulfillments, session.startedAt);

  let updatedProfile = applySessionStats(profile, session, { nightPointsMultiplier });
  if (gamificationPatch && typeof gamificationPatch === 'object') {
    updatedProfile = { ...updatedProfile, gamification: gamificationPatch };
  }

  let completed = {
    ...session,
    status: 'completed',
    endedAt: session.endedAt ?? new Date().toISOString(),
    baseCostEur,
    rewardDiscountEur,
    costEur,
    rewardLabel: session.rewardLabel,
  };

  if (session.appliedFulfillmentId) {
    const fulfillment = await getFulfillmentById(req.userId, session.appliedFulfillmentId);
    if (fulfillment && shouldConsumeFulfillment(fulfillment)) {
      await markFulfillmentUsed(req.userId, fulfillment.id, completed.id);
    }
  }

  await upsertSession(req.userId, completed);
  await updateUserProfile(req.userId, updatedProfile);

  let invoice = null;
  try {
    const issued = await issueInvoiceForSession(req.userId, completed);
    if (issued.ok) {
      completed = issued.session;
      invoice = {
        invoiceNumber: issued.invoiceNumber,
        emailSent: issued.emailSent,
        emailSkipped: issued.emailSkipped,
      };
    }
  } catch (e) {
    console.error('[bc-charge] Rechnungsversand fehlgeschlagen:', e);
    invoice = { error: 'Rechnung konnte nicht versendet werden.' };
  }

  res.json({
    session: completed,
    user: rowToProfile(await findUserById(req.userId)),
    invoice,
  });
});

export default router;
