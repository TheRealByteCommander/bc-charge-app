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

  try {
    const issued = await issueInvoiceForSession(req.userId, session);
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
