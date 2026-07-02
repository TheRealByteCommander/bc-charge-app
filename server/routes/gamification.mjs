import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.mjs';
import { findUserById, updateUserProfile, getLeaderboardData } from '../db.mjs';

const router = Router();

const weeklyChallenges = [
  {
    id: 'ch_sessions_3',
    titleDe: 'Dreifach-Lader',
    titleEn: 'Triple charger',
    descDe: '3 Ladesitzungen diese Woche',
    descEn: '3 charging sessions this week',
    target: 3,
    rewardPoints: 200,
    metric: 'sessions_week',
  },
  {
    id: 'ch_points_500',
    titleDe: 'Points-Sprinter',
    titleEn: 'Points sprinter',
    descDe: '500 BC Points diese Woche sammeln',
    descEn: 'Earn 500 BC Points this week',
    target: 500,
    rewardPoints: 150,
    metric: 'points_week',
  },
  {
    id: 'ch_stations_2',
    titleDe: 'Netz-Entdecker',
    titleEn: 'Network explorer',
    descDe: '2 verschiedene Stationen diese Woche',
    descEn: '2 different stations this week',
    target: 2,
    rewardPoints: 175,
    metric: 'stations_week',
  },
  {
    id: 'ch_streak_5',
    titleDe: 'Streak-Meister',
    titleEn: 'Streak master',
    descDe: '5 Tage Ladestreak',
    descEn: '5-day charging streak',
    target: 5,
    rewardPoints: 300,
    metric: 'streak_days',
  },
];

function getWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getChallengeProgress(challenge, gamification) {
  const g = gamification ?? {};
  switch (challenge.metric) {
    case 'sessions_week':
      return Math.min(challenge.target, g.sessionsThisWeek ?? 0);
    case 'points_week':
      return Math.min(challenge.target, g.weeklyPoints ?? 0);
    case 'stations_week':
      return Math.min(challenge.target, (g.stationsThisWeek ?? []).length);
    case 'streak_days':
      return Math.min(challenge.target, g.currentStreakDays ?? 0);
    default:
      return 0;
  }
}

function isChallengeComplete(challenge, gamification) {
  return getChallengeProgress(challenge, gamification) >= challenge.target;
}

function computeTier(points) {
  if (points >= 8000) return 'platinum';
  if (points >= 4000) return 'gold';
  if (points >= 1500) return 'silver';
  return 'bronze';
}

router.get('/challenges', requireAuth, async (req, res) => {
  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden' });
    return;
  }

  const profile = JSON.parse(row.profile ?? '{}');
  const gamification = profile.gamification ?? {};
  const currentWeek = getWeekKey();

  if (gamification.weekKey !== currentWeek) {
    gamification.weekKey = currentWeek;
    gamification.weeklyPoints = 0;
    gamification.sessionsThisWeek = 0;
    gamification.stationsThisWeek = [];
    gamification.completedChallengeIds = [];
  }

  const challenges = weeklyChallenges.map((ch) => ({
    ...ch,
    progress: getChallengeProgress(ch, gamification),
    isComplete: isChallengeComplete(ch, gamification),
    isClaimed: (gamification.completedChallengeIds ?? []).includes(ch.id),
  }));

  res.json({
    weekKey: currentWeek,
    challenges,
    stats: {
      sessionsThisWeek: gamification.sessionsThisWeek ?? 0,
      weeklyPoints: gamification.weeklyPoints ?? 0,
      stationsThisWeek: (gamification.stationsThisWeek ?? []).length,
      currentStreakDays: gamification.currentStreakDays ?? 0,
    },
  });
});

router.post('/challenges/:id/claim', requireAuth, async (req, res) => {
  const { id } = req.params;
  const challenge = weeklyChallenges.find((ch) => ch.id === id);
  
  if (!challenge) {
    res.status(404).json({ error: 'Challenge nicht gefunden' });
    return;
  }

  const row = await findUserById(req.userId);
  if (!row) {
    res.status(404).json({ error: 'Nutzer nicht gefunden' });
    return;
  }

  const profile = JSON.parse(row.profile ?? '{}');
  const gamification = profile.gamification ?? {};

  if ((gamification.completedChallengeIds ?? []).includes(id)) {
    res.status(400).json({ error: 'Challenge bereits abgeschlossen' });
    return;
  }

  if (!isChallengeComplete(challenge, gamification)) {
    res.status(400).json({ error: 'Ziel noch nicht erreicht' });
    return;
  }

  gamification.completedChallengeIds = [...(gamification.completedChallengeIds ?? []), id];
  gamification.weeklyPoints = (gamification.weeklyPoints ?? 0) + challenge.rewardPoints;

  const newPoints = (profile.loyaltyPoints ?? 0) + challenge.rewardPoints;
  profile.loyaltyPoints = newPoints;
  profile.loyaltyTier = computeTier(newPoints);
  profile.gamification = gamification;

  await updateUserProfile(req.userId, profile);

  res.json({
    ok: true,
    pointsAwarded: challenge.rewardPoints,
    newTotalPoints: newPoints,
    newTier: profile.loyaltyTier,
  });
});

router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const entries = await getLeaderboardData(20);
    
    let userRank = null;
    if (req.userId) {
      const userEntry = entries.find((e) => e.userId === req.userId);
      if (userEntry) {
        userRank = entries.indexOf(userEntry) + 1;
      }
    }

    const board = entries.map((entry, index) => ({
      rank: index + 1,
      displayName: entry.displayName,
      points: entry.points,
      tier: entry.tier,
      isCurrentUser: req.userId ? entry.userId === req.userId : false,
    }));

    res.json({
      leaderboard: board,
      userRank,
      totalParticipants: entries.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Leaderboard konnte nicht geladen werden' });
  }
});

export default router;
