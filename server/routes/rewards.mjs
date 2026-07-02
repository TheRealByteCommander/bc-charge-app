import { Router } from 'express';
import { listFulfillments } from '../db.mjs';
import { requireAuth } from '../middleware/auth.mjs';
import { isFulfillmentActive } from '../services/rewardFulfillment.mjs';

const router = Router();

router.get('/fulfillments', requireAuth, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const fulfillments = await listFulfillments(req.userId, { status });
  const now = new Date();
  res.json({
    fulfillments: fulfillments.map((f) => ({
      ...f,
      isActive: isFulfillmentActive(f, now),
    })),
  });
});

export default router;
