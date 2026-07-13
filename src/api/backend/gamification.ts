import { apiConfig } from '../../config/api';

interface ChallengeResponse {
  id: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  target: number;
  rewardPoints: number;
  metric: string;
  progress: number;
  isComplete: boolean;
  isClaimed: boolean;
}

interface ChallengesApiResponse {
  weekKey: string;
  challenges: ChallengeResponse[];
  stats: {
    sessionsThisWeek: number;
    weeklyPoints: number;
    stationsThisWeek: number;
    currentStreakDays: number;
  };
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  points: number;
  tier: string;
  isCurrentUser: boolean;
}

interface LeaderboardApiResponse {
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  totalParticipants: number;
}

interface ClaimResponse {
  ok: boolean;
  pointsAwarded: number;
  newTotalPoints: number;
  newTier: string;
}

/**
 * Lädt Challenge-Daten vom Backend
 */
export async function fetchChallengesFromBackend(): Promise<ChallengesApiResponse> {
  const res = await fetch(`${apiConfig.baseUrl}/api/gamification/challenges`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Challenges konnten nicht geladen werden');
  }

  return res.json();
}

/**
 * Löst eine Challenge-Belohnung ein
 */
export async function claimChallengeFromBackend(challengeId: string): Promise<ClaimResponse> {
  const res = await fetch(`${apiConfig.baseUrl}/api/gamification/challenges/${challengeId}/claim`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Einlösung fehlgeschlagen' }));
    throw new Error(error.error ?? 'Einlösung fehlgeschlagen');
  }

  return res.json();
}

/**
 * Lädt Leaderboard-Daten vom Backend
 */
export async function fetchLeaderboardFromBackend(): Promise<LeaderboardApiResponse> {
  const res = await fetch(`${apiConfig.baseUrl}/api/gamification/leaderboard`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Leaderboard konnte nicht geladen werden');
  }

  return res.json();
}
