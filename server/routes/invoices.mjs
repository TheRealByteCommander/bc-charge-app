import { Router } from 'express';
import { findSessionById } from '../db.mjs';
import { requireAuth } from '../middleware/auth.mjs';
import { issueInvoiceForSession } from '../services/invoices.mjs';

const router = Router();

router.get('/:sessionId/pdf', requireAuth, async (req, res) => {
  const session = await findSessionById(req.userId, req.params.sessionId);
  if (!session || session.status !== 'completed') {
    res.status(404).json({ error: 'Rechnung nicht gefunden.' });
    return;
  }

  if (session.billingStatus === 'deferred' || session.paymentStatus === 'deferred') {
    res.status(409).json({
      error:
        'Noch keine Rechnung — Beträge unter 1 € werden gesammelt und ab 1 € als Sammelrechnung ausgestellt.',
    });
    return;
  }

  if (!session.invoiceNumber) {
    res.status(404).json({ error: 'Für diesen Ladevorgang liegt keine Rechnung vor.' });
    return;
  }

  try {
    // Collective: rebuild multi-session PDF from all sessions sharing invoiceNumber
    let invoiceSession = session;
    if (session.invoiceKind === 'collective' || session.batchId) {
      const { listSessions } = await import('../db.mjs');
      const { buildCollectiveInvoiceSession, fromCents, sessionUsageCents } = await import(
        '../services/accountBilling.mjs'
      );
      const all = await listSessions(req.userId);
      const members = all.filter(
        (s) =>
          s &&
          (s.invoiceNumber === session.invoiceNumber ||
            (session.batchId && s.batchId === session.batchId))
      );
      if (members.length > 0) {
        const totalCents = members.reduce((a, s) => a + sessionUsageCents(s), 0);
        const totalEur =
          session.batchTotalEur != null && Number.isFinite(Number(session.batchTotalEur))
            ? Number(session.batchTotalEur)
            : fromCents(totalCents);
        invoiceSession = buildCollectiveInvoiceSession({
          batchId: session.batchId || session.invoiceNumber,
          sessions: members,
          totalEur,
          paymentStatus: session.paymentStatus || 'paid',
          stripePaymentIntentId: session.stripePaymentIntentId,
          paymentMethodId: session.paymentMethodId,
        });
        invoiceSession.invoiceNumber = session.invoiceNumber;
      }
    }

    const issued = await issueInvoiceForSession(req.userId, invoiceSession, {
      skipSessionUpsert: true,
    });
    if (!issued.ok || !issued.pdfBuffer) {
      res.status(500).json({ error: issued.error ?? 'Rechnung konnte nicht erstellt werden.' });
      return;
    }

    const invoiceNumber = issued.invoiceNumber;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    res.send(issued.pdfBuffer);
  } catch (e) {
    console.error('[bc-charge] PDF-Erzeugung fehlgeschlagen:', e);
    res.status(500).json({ error: 'Rechnung konnte nicht erstellt werden.' });
  }
});

export default router;
