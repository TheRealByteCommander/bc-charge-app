import type { ChallengeDefinition } from '../types/gamification';

export const weeklyChallenges: ChallengeDefinition[] = [
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
