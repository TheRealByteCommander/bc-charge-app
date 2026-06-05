import { Router } from 'express';
import { findUserById, listRedeemed, rowToProfile, updateUserProfile, addRedeemed, setRedeemed } from '../db.mjs';
import { computeTier } from '../services/loyalty.mjs';
import { requireAuth } from '../middleware/auth.mjs';

const router = Router();

const BLOCKED_KEYS = new Set(['id', 'email', 'passwordHash', 'memberSince', 'membershipId']);

router.patch('/', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden.' });
    return;
  }

  const patch = req.body ?? {};
  const safe = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!BLOCKED_KEYS.has(key)) safe[key] = value;
  }

  if (typeof safe.loyaltyPoints === 'number') {
    safe.loyaltyTier = computeTier(safe.loyaltyPoints);
  }

  const stripeCustomerId = patch.stripeCustomerId;
  await updateUserProfile(req.userId, safe, stripeCustomerId);
  res.json({ user: rowToProfile(await findUserById(req.userId)) });
});

router.get('/redeemed', requireAuth, async (req, res) => {
  res.json({ rewardIds: await listRedeemed(req.userId) });
});

router.post('/redeemed', requireAuth, async (req, res) => {
  const { rewardIds } = req.body ?? {};
  if (!Array.isArray(rewardIds)) {
    res.status(400).json({ error: 'rewardIds muss ein Array sein.' });
    return;
  }
  await setRedeemed(req.userId, rewardIds.map(String));
  res.json({ rewardIds: await listRedeemed(req.userId) });
});

router.post('/redeem', requireAuth, async (req, res) => {
  const { rewardId, pointsCost } = req.body ?? {};
  if (!rewardId || typeof pointsCost !== 'number') {
    res.status(400).json({ error: 'rewardId und pointsCost erforderlich.' });
    return;
  }

  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden.' });
    return;
  }

  const profile = rowToProfile(row);
  const redeemed = await listRedeemed(req.userId);
  if (redeemed.includes(rewardId)) {
    res.status(409).json({ error: 'Prämie wurde bereits eingelöst.' });
    return;
  }
  if (profile.loyaltyPoints < pointsCost) {
    res.status(400).json({ error: 'Nicht genügend BC Points.' });
    return;
  }

  const newPoints = profile.loyaltyPoints - pointsCost;
  await updateUserProfile(req.userId, {
    loyaltyPoints: newPoints,
    loyaltyTier: computeTier(newPoints),
  });
  await addRedeemed(req.userId, rewardId);

  res.json({
    user: rowToProfile(await findUserById(req.userId)),
    rewardIds: await listRedeemed(req.userId),
  });
});

export default router;
