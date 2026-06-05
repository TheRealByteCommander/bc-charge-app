import { Router } from 'express';
import {
  findUserById,
  listSessions,
  replaceSessions,
  rowToProfile,
  updateUserProfile,
  upsertSession,
} from '../db.mjs';
import { requireAuth } from '../middleware/auth.mjs';
import { validateSessionCost } from '../services/chargeValidation.mjs';
import { issueInvoiceForSession } from '../services/invoices.mjs';
import { applySessionStats } from '../services/loyalty.mjs';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  res.json({ sessions: await listSessions(req.userId) });
});

router.put('/', requireAuth, async (req, res) => {
  const { sessions } = req.body ?? {};
  if (!Array.isArray(sessions)) {
    res.status(400).json({ error: 'sessions muss ein Array sein.' });
    return;
  }
  await replaceSessions(req.userId, sessions);
  res.json({ sessions: await listSessions(req.userId) });
});

router.post('/', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id) {
    res.status(400).json({ error: 'session mit id erforderlich.' });
    return;
  }
  await upsertSession(req.userId, session);
  res.status(201).json({ session });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id || session.id !== req.params.id) {
    res.status(400).json({ error: 'Ungültige Sitzungsdaten.' });
    return;
  }
  await upsertSession(req.userId, session);
  res.json({ session });
});

router.post('/:id/complete', requireAuth, async (req, res) => {
  const session = req.body?.session;
  if (!session?.id || session.id !== req.params.id) {
    res.status(400).json({ error: 'Ungültige Sitzungsdaten.' });
    return;
  }

  const costError = validateSessionCost({
    energyKwh: session.energyKwh,
    costEur: session.costEur,
    pricePerKwh: session.pricePerKwh,
    sessionFee: session.sessionFee,
    minutes: session.endedAt && session.startedAt
      ? (new Date(session.endedAt) - new Date(session.startedAt)) / 60000
      : 0,
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
  let updatedProfile = applySessionStats(profile, session);
  if (gamificationPatch && typeof gamificationPatch === 'object') {
    updatedProfile = { ...updatedProfile, gamification: gamificationPatch };
  }

  let completed = {
    ...session,
    status: 'completed',
    endedAt: session.endedAt ?? new Date().toISOString(),
  };

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
