export interface GamificationState {
  unlockedBadgeIds: string[];
  currentStreakDays: number;
  longestStreakDays: number;
  /** Letzter Ladgetag YYYY-MM-DD */
  lastChargeDay: string | null;
  weeklyPoints: number;
  /** ISO-Woche z. B. 2026-W23 */
  weekKey: string | null;
  completedChallengeIds: string[];
  uniqueStationsCharged: string[];
  sessionsThisWeek: number;
  stationsThisWeek: string[];
  reportsSubmitted: number;
}

export interface BadgeDefinition {
  id: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  icon: string;
  bonusPoints: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface ChallengeDefinition {
  id: string;
  titleDe: string;
  titleEn: string;
  descDe: string;
  descEn: string;
  target: number;
  rewardPoints: number;
  metric: 'sessions_week' | 'points_week' | 'stations_week' | 'reports' | 'streak_days';
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  points: number;
  tier: string;
  isCurrentUser?: boolean;
}
