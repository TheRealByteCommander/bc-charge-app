import { badges, getBadgeById } from '../data/badges';
import { weeklyChallenges } from '../data/challenges';
import { computeTier } from '../data/rewards';
import type { ChargingSession, UserProfile } from '../types';
import type {
  ChallengeDefinition,
  GamificationState,
  LeaderboardEntry,
} from '../types/gamification';

export function defaultGamification(): GamificationState {
  return {
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
  };
}

export function normalizeGamification(g?: Partial<GamificationState> | null): GamificationState {
  return { ...defaultGamification(), ...g };
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function getWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function rolloverWeek(
  state: GamificationState,
  pointsEarned: number,
  stationId: string
): GamificationState {
  const wk = getWeekKey();
  if (state.weekKey === wk) {
    const stations = new Set(state.stationsThisWeek);
    stations.add(stationId);
    return {
      ...state,
      weeklyPoints: state.weeklyPoints + pointsEarned,
      sessionsThisWeek: state.sessionsThisWeek + 1,
      stationsThisWeek: [...stations],
    };
  }
  return {
    ...state,
    weekKey: wk,
    weeklyPoints: pointsEarned,
    sessionsThisWeek: 1,
    stationsThisWeek: [stationId],
    completedChallengeIds: [],
  };
}

function updateStreak(state: GamificationState, chargeDay: string): GamificationState {
  if (!state.lastChargeDay) {
    return {
      ...state,
      lastChargeDay: chargeDay,
      currentStreakDays: 1,
      longestStreakDays: Math.max(1, state.longestStreakDays),
    };
  }
  if (state.lastChargeDay === chargeDay) return state;

  const last = new Date(state.lastChargeDay);
  const curr = new Date(chargeDay);
  const diffDays = Math.round((curr.getTime() - last.getTime()) / 86400000);

  let streak = 1;
  if (diffDays === 1) streak = state.currentStreakDays + 1;

  return {
    ...state,
    lastChargeDay: chargeDay,
    currentStreakDays: streak,
    longestStreakDays: Math.max(state.longestStreakDays, streak),
  };
}

export interface BadgeEvalContext {
  totalSessions: number;
  totalKwh: number;
  co2SavedKg: number;
  loyaltyTier: UserProfile['loyaltyTier'];
  sessionEndedAt?: string;
}

function shouldUnlockBadge(id: string, ctx: BadgeEvalContext, state: GamificationState): boolean {
  const hour = ctx.sessionEndedAt ? new Date(ctx.sessionEndedAt).getHours() : 12;

  switch (id) {
    case 'first_charge':
      return ctx.totalSessions >= 1;
    case 'streak_3':
      return state.currentStreakDays >= 3;
    case 'streak_7':
      return state.currentStreakDays >= 7;
    case 'kwh_100':
      return ctx.totalKwh >= 100;
    case 'eco_50':
      return ctx.co2SavedKg >= 50;
    case 'explorer':
      return state.uniqueStationsCharged.length >= 5;
    case 'community':
      return state.reportsSubmitted >= 1;
    case 'silver_tier':
      return ctx.loyaltyTier === 'silver' || ctx.loyaltyTier === 'gold' || ctx.loyaltyTier === 'platinum';
    case 'gold_tier':
      return ctx.loyaltyTier === 'gold' || ctx.loyaltyTier === 'platinum';
    case 'platinum_tier':
      return ctx.loyaltyTier === 'platinum';
    case 'night_owl':
      return hour >= 22 || hour < 6;
    case 'sessions_10':
      return ctx.totalSessions >= 10;
    default:
      return false;
  }
}

function evaluateNewBadges(
  state: GamificationState,
  ctx: BadgeEvalContext
): { state: GamificationState; newBadgeIds: string[]; bonusPoints: number } {
  const newBadgeIds: string[] = [];
  let bonusPoints = 0;

  for (const badge of badges) {
    if (state.unlockedBadgeIds.includes(badge.id)) continue;
    if (!shouldUnlockBadge(badge.id, ctx, state)) continue;
    newBadgeIds.push(badge.id);
    bonusPoints += badge.bonusPoints;
  }

  if (!newBadgeIds.length) return { state, newBadgeIds, bonusPoints: 0 };

  return {
    state: { ...state, unlockedBadgeIds: [...state.unlockedBadgeIds, ...newBadgeIds] },
    newBadgeIds,
    bonusPoints,
  };
}

export function getChallengeProgress(
  challenge: ChallengeDefinition,
  state: GamificationState
): number {
  switch (challenge.metric) {
    case 'sessions_week':
      return Math.min(challenge.target, state.sessionsThisWeek);
    case 'points_week':
      return Math.min(challenge.target, state.weeklyPoints);
    case 'stations_week':
      return Math.min(challenge.target, state.stationsThisWeek.length);
    case 'streak_days':
      return Math.min(challenge.target, state.currentStreakDays);
    case 'reports':
      return Math.min(challenge.target, state.reportsSubmitted);
    default:
      return 0;
  }
}

export function isChallengeComplete(challenge: ChallengeDefinition, state: GamificationState): boolean {
  return getChallengeProgress(challenge, state) >= challenge.target;
}

export interface GamificationResult {
  user: UserProfile;
  pointsDelta: number;
  newBadgeIds: string[];
  completedChallengeIds: string[];
}

export function processSessionGamification(user: UserProfile, session: ChargingSession): GamificationResult {
  const chargeDay = todayKey(new Date(session.endedAt ?? session.startedAt));
  let g = normalizeGamification(user.gamification);
  g = rolloverWeek(g, session.pointsEarned, session.stationId);
  g = updateStreak(g, chargeDay);

  const allStations = new Set(g.uniqueStationsCharged);
  allStations.add(session.stationId);
  g = { ...g, uniqueStationsCharged: [...allStations] };

  const totalSessions = user.totalSessions + 1;
  const totalKwh = user.totalKwh + session.energyKwh;
  const co2SavedKg = Math.round(user.co2SavedKg + session.energyKwh * 0.64);

  let pointsDelta = session.pointsEarned;
  let loyaltyPoints = user.loyaltyPoints + session.pointsEarned;

  const tierBefore = user.loyaltyTier;

  const runBadges = (tier: UserProfile['loyaltyTier']) => {
    const res = evaluateNewBadges(g, {
      totalSessions,
      totalKwh,
      co2SavedKg,
      loyaltyTier: tier,
      sessionEndedAt: session.endedAt,
    });
    g = res.state;
    return res;
  };

  const badgeRes = runBadges(tierBefore);
  pointsDelta += badgeRes.bonusPoints;
  loyaltyPoints += badgeRes.bonusPoints;
  const newBadgeIds = [...badgeRes.newBadgeIds];

  const tierAfterPoints = computeTier(loyaltyPoints);
  const tierRes = runBadges(tierAfterPoints);
  pointsDelta += tierRes.bonusPoints;
  loyaltyPoints += tierRes.bonusPoints;
  newBadgeIds.push(...tierRes.newBadgeIds.filter((id) => !newBadgeIds.includes(id)));

  const completedChallengeIds: string[] = [];
  for (const ch of weeklyChallenges) {
    if (g.completedChallengeIds.includes(ch.id)) continue;
    if (!isChallengeComplete(ch, g)) continue;
    g = { ...g, completedChallengeIds: [...g.completedChallengeIds, ch.id] };
    pointsDelta += ch.rewardPoints;
    loyaltyPoints += ch.rewardPoints;
    completedChallengeIds.push(ch.id);
  }

  const extraWeekly = pointsDelta - session.pointsEarned;
  if (extraWeekly > 0) {
    g = { ...g, weeklyPoints: g.weeklyPoints + extraWeekly };
  }

  const updatedUser: UserProfile = {
    ...user,
    totalSessions,
    totalKwh,
    co2SavedKg,
    loyaltyPoints,
    loyaltyTier: computeTier(loyaltyPoints),
    gamification: g,
  };

  return { user: updatedUser, pointsDelta, newBadgeIds, completedChallengeIds };
}

/** Belohnung für erfüllte Challenges, die noch nicht ausgezahlt wurden (z. B. nach Report). */
export function syncPendingChallenges(user: UserProfile): GamificationResult {
  let g = normalizeGamification(user.gamification);
  let pointsDelta = 0;
  const completedChallengeIds: string[] = [];

  for (const ch of weeklyChallenges) {
    if (g.completedChallengeIds.includes(ch.id)) continue;
    if (!isChallengeComplete(ch, g)) continue;
    g = { ...g, completedChallengeIds: [...g.completedChallengeIds, ch.id] };
    pointsDelta += ch.rewardPoints;
    completedChallengeIds.push(ch.id);
  }

  if (!pointsDelta) {
    return { user, pointsDelta: 0, newBadgeIds: [], completedChallengeIds: [] };
  }

  const loyaltyPoints = user.loyaltyPoints + pointsDelta;
  return {
    user: {
      ...user,
      loyaltyPoints,
      loyaltyTier: computeTier(loyaltyPoints),
      gamification: { ...g, weeklyPoints: g.weeklyPoints + pointsDelta },
    },
    pointsDelta,
    newBadgeIds: [],
    completedChallengeIds,
  };
}

export function processReportGamification(user: UserProfile): GamificationResult {
  let g = normalizeGamification(user.gamification);
  g = { ...g, reportsSubmitted: g.reportsSubmitted + 1 };

  const { state, newBadgeIds, bonusPoints } = evaluateNewBadges(g, {
    totalSessions: user.totalSessions,
    totalKwh: user.totalKwh,
    co2SavedKg: user.co2SavedKg,
    loyaltyTier: user.loyaltyTier,
  });

  const loyaltyPoints = user.loyaltyPoints + bonusPoints;
  return {
    user: {
      ...user,
      gamification: state,
      loyaltyPoints,
      loyaltyTier: computeTier(loyaltyPoints),
    },
    pointsDelta: bonusPoints,
    newBadgeIds,
    completedChallengeIds: [],
  };
}

export function claimChallengeReward(
  user: UserProfile,
  challengeId: string
): { ok: boolean; error?: string; user?: UserProfile; pointsDelta?: number } {
  const ch = weeklyChallenges.find((c) => c.id === challengeId);
  if (!ch) return { ok: false, error: 'Challenge nicht gefunden' };
  const g = normalizeGamification(user.gamification);
  if (g.completedChallengeIds.includes(challengeId)) {
    return { ok: false, error: 'Bereits abgeschlossen' };
  }
  if (!isChallengeComplete(ch, g)) {
    return { ok: false, error: 'Ziel noch nicht erreicht' };
  }
  const loyaltyPoints = user.loyaltyPoints + ch.rewardPoints;
  return {
    ok: true,
    pointsDelta: ch.rewardPoints,
    user: {
      ...user,
      loyaltyPoints,
      loyaltyTier: computeTier(loyaltyPoints),
      gamification: {
        ...g,
        completedChallengeIds: [...g.completedChallengeIds, challengeId],
      },
    },
  };
}

export function buildLeaderboard(user: UserProfile | null): LeaderboardEntry[] {
  if (!user) return [];

  const you: LeaderboardEntry = {
    rank: 1,
    displayName: `${user.firstName} ${user.lastName[0]}.`,
    points: user.loyaltyPoints,
    tier: user.loyaltyTier,
    isCurrentUser: true,
  };

  return [you];
}

export function countUnlockedBadges(state: GamificationState): number {
  return state.unlockedBadgeIds.length;
}

export function badgeProgressPercent(state: GamificationState): number {
  return Math.round((state.unlockedBadgeIds.length / badges.length) * 100);
}

export function formatGamificationToast(
  result: Pick<GamificationResult, 'pointsDelta' | 'newBadgeIds' | 'completedChallengeIds'>,
  locale: 'de' | 'en'
): string {
  const parts: string[] = [];
  if (locale === 'de') {
    parts.push(`+${result.pointsDelta} BC Points`);
    if (result.newBadgeIds.length) {
      const icons = result.newBadgeIds.map((id) => getBadgeById(id)?.icon ?? '🏅').join('');
      parts.push(`${result.newBadgeIds.length} Abzeichen ${icons}`);
    }
    if (result.completedChallengeIds.length) {
      parts.push(`${result.completedChallengeIds.length} Challenge geschafft`);
    }
  } else {
    parts.push(`+${result.pointsDelta} BC Points`);
    if (result.newBadgeIds.length) parts.push(`${result.newBadgeIds.length} badge(s) unlocked`);
    if (result.completedChallengeIds.length) parts.push(`${result.completedChallengeIds.length} challenge(s) done`);
  }
  return parts.join(' · ');
}
