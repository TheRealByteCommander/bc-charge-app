import { Router } from 'express';
import logger from '../utils/logger.mjs';
import { db } from '../db.mjs';

const router = Router();

/**
 * CitrineOS Webhook for Transaction Events.
 * Expected payload typically includes transactionId, remoteStartId, and state.
 */
router.post('/', async (req, res) => {
  const payload = req.body;
  
  if (!payload) {
    res.status(400).json({ error: 'Empty payload' });
    return;
  }

  logger.info('[CitrineOS Webhook] Received event', payload);

  try {
    // 1. Handle Transaction Start / Resolution
    // When a remoteStartTransaction is successful, CitrineOS may send an event 
    // containing the mapping between remoteStartId and the resulting transactionId.
    if (payload.remoteStartId && payload.transactionId) {
      logger.info(`[CitrineOS Webhook] Resolving transactionId ${payload.transactionId} for remoteStartId ${payload.remoteStartId}`);
      
      // Update any pending sessions in the database that are waiting for this remoteStartId
      const result = await db.run(
        `UPDATE sessions 
         SET citrineosTransactionId = ?, 
             status = 'active' 
         WHERE remoteStartId = ? AND status = 'pending'`,
        [payload.transactionId, payload.remoteStartId]
      );
      
      if (result.changes && result.changes > 0) {
        logger.info(`[CitrineOS Webhook] Successfully updated ${result.changes} session(s).`);
      }
    }

    // 2. Handle Transaction Updates (Meter values, Cost, etc.)
    if (payload.transactionId && payload.totalKwh !== undefined) {
      logger.info(`[CitrineOS Webhook] Updating metrics for tx ${payload.transactionId}: ${payload.totalKwh} kWh`);
      
      await db.run(
        `UPDATE sessions 
         SET energyKwh = ?, 
             costEur = ? 
         WHERE citrineosTransactionId = ? AND status = 'active'`,
        [payload.totalKwh, payload.totalCost, payload.transactionId]
      );
    }

    // 3. Handle Transaction Stop
    if (payload.transactionId && payload.isActive === false) {
      logger.info(`[CitrineOS Webhook] Transaction ${payload.transactionId} stopped.`);
      
      await db.run(
        `UPDATE sessions 
         SET status = 'completed', 
             endedAt = CURRENT_TIMESTAMP 
         WHERE citrineosTransactionId = ? AND status = 'active'`,
        [payload.transactionId]
      );
    }

    res.json({ received: true });
  } catch (e) {
    logger.error('[CitrineOS Webhook] Error processing event:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
