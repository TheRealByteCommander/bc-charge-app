import { Router } from 'express';
import {
  deleteUser,
  findUserByEmail,
  findUserById,
  insertUser,
  listRedeemed,
  listSessions,
  rowToProfile,
  updateUserPassword,
} from '../db.mjs';
import { hashPassword, upgradePasswordHashIfLegacy, verifyPassword } from '../auth/password.mjs';
import { clearSessionCookie, createSessionToken, setSessionCookie } from '../auth/session.mjs';
import { requireAuth } from '../middleware/auth.mjs';

const router = Router();

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateMembershipId() {
  return `BC-${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
}

router.post('/register', async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    acceptPrivacy,
    acceptTerms,
    marketingOptIn,
  } = req.body ?? {};

  if (!acceptPrivacy || !acceptTerms) {
    res.status(400).json({ error: 'Bitte Datenschutz und Nutzungsbedingungen bestätigen.' });
    return;
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Ungültige E-Mail.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
    return;
  }
  if (await findUserByEmail(email)) {
    res.status(409).json({ error: 'Diese E-Mail ist bereits registriert.' });
    return;
  }

  const now = new Date().toISOString();
  const marketing = Boolean(marketingOptIn);
  const id = generateId('user');
  const profile = {
    firstName: String(firstName ?? '').slice(0, 80),
    lastName: String(lastName ?? '').slice(0, 80),
    phone: String(phone ?? '').slice(0, 40),
    memberSince: now,
    membershipId: generateMembershipId(),
    loyaltyPoints: 250,
    loyaltyTier: 'bronze',
    totalKwh: 0,
    totalSessions: 0,
    co2SavedKg: 0,
    vehicles: [],
    paymentMethods: [],
    favoriteStationIds: [],
    notifications: {
      sessionComplete: true,
      promotions: marketing,
      stationAvailability: false,
      loyaltyUpdates: true,
    },
    chargingPlan: { enabled: true, snoozedUntil: null, expandedOnHome: false },
    gamification: {
      unlockedBadgeIds: [],
      currentStreakDays: 0,
      longestStreakDays: 0,
      lastChargeDay: null,
      weeklyPoints: 0,
      weekKey: null,
      completedChallengeIds: [],
      uniqueStationsCharged: [],
      sessionsThisWeek: 0,
      stationsThisWeek: [],
      reportsSubmitted: 0,
    },
    privacyConsentAt: now,
    termsAcceptedAt: now,
    marketingConsentAt: marketing ? now : null,
  };

  await insertUser({
    id,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    profile,
  });

  const token = await createSessionToken(id);
  setSessionCookie(res, token);
  res.status(201).json({ user: rowToProfile(await findUserById(id)) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
    return;
  }

  const row = await findUserByEmail(String(email));
  if (!row || !verifyPassword(String(password), row.password_hash)) {
    res.status(401).json({ error: 'E-Mail oder Passwort ist ungültig.' });
    return;
  }

  const upgraded = upgradePasswordHashIfLegacy(String(password), row.password_hash);
  if (upgraded !== row.password_hash) {
    await updateUserPassword(row.id, upgraded);
  }

  const token = await createSessionToken(row.id);
  setSessionCookie(res, token);
  res.json({ user: rowToProfile(await findUserById(row.id)) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId);
  if (!row) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Nutzer nicht gefunden.' });
    return;
  }
  res.json({ user: rowToProfile(row) });
});

router.get('/export', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden.' });
    return;
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    format: 'BC Charge Datenexport (Art. 20 DSGVO)',
    profile: rowToProfile(row),
    sessions: await listSessions(req.userId),
    redeemedRewards: await listRedeemed(req.userId),
    note: 'Passwörter werden aus Sicherheitsgründen nicht exportiert. Zahlungsdaten liegen bei Stripe.',
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="bc-charge-export-${new Date().toISOString().slice(0, 10)}.json"`
  );
  res.send(JSON.stringify(payload, null, 2));
});

router.delete('/account', requireAuth, async (req, res) => {
  await deleteUser(req.userId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;
