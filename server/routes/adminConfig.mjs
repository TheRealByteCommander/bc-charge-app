import { Router } from 'express';
import { requireAuth } from '../middleware/auth.mjs';
import { getLoyaltyConfig, setLoyaltyConfig } from '../services/configService.mjs';

const router = Router();

router.get('/loyalty', requireAuth, async (req, res) => {
  try {
    const config = await getLoyaltyConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Loyalty-Konfiguration' });
  }
});

router.post('/loyalty', requireAuth, async (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Ungültige Konfiguration' });
      return;
    }
    await setLoyaltyConfig(config);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Speichern der Loyalty-Konfiguration' });
  }
});

export default router;
