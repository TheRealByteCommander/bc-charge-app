import type { ChargingSession, RewardFulfillment, UserProfile } from '../types';

const KEYS = {
  users: 'bc_users',
  currentUserId: 'bc_current_user',
  sessions: 'bc_sessions',
  onboarding: 'bc_onboarding_done',
  redeemedRewards: 'bc_redeemed',
  rewardFulfillments: 'bc_reward_fulfillments',
} as const;

export function loadUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(KEYS.users);
    return raw ? (JSON.parse(raw) as UserProfile[]) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem(KEYS.currentUserId);
}

export function setCurrentUserId(id: string | null): void {
  if (id) localStorage.setItem(KEYS.currentUserId, id);
  else localStorage.removeItem(KEYS.currentUserId);
}

export function loadSessions(userId: string): ChargingSession[] {
  try {
    const raw = localStorage.getItem(KEYS.sessions);
    const all = raw ? (JSON.parse(raw) as Record<string, ChargingSession[]>) : {};
    return all[userId] ?? [];
  } catch {
    return [];
  }
}

export function saveSessions(userId: string, sessions: ChargingSession[]): void {
  const raw = localStorage.getItem(KEYS.sessions);
  const all = raw ? (JSON.parse(raw) as Record<string, ChargingSession[]>) : {};
  all[userId] = sessions;
  localStorage.setItem(KEYS.sessions, JSON.stringify(all));
}

export function isOnboardingDone(): boolean {
  return localStorage.getItem(KEYS.onboarding) === '1';
}

export function setOnboardingDone(): void {
  localStorage.setItem(KEYS.onboarding, '1');
}

export function loadRedeemed(userId: string): string[] {
  try {
    const raw = localStorage.getItem(KEYS.redeemedRewards);
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return all[userId] ?? [];
  } catch {
    return [];
  }
}

export function saveRedeemed(userId: string, ids: string[]): void {
  const raw = localStorage.getItem(KEYS.redeemedRewards);
  const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  all[userId] = ids;
  localStorage.setItem(KEYS.redeemedRewards, JSON.stringify(all));
}

export function loadFulfillments(userId: string): RewardFulfillment[] {
  try {
    const raw = localStorage.getItem(KEYS.rewardFulfillments);
    const all = raw ? (JSON.parse(raw) as Record<string, RewardFulfillment[]>) : {};
    return all[userId] ?? [];
  } catch {
    return [];
  }
}

export function saveFulfillments(userId: string, fulfillments: RewardFulfillment[]): void {
  const raw = localStorage.getItem(KEYS.rewardFulfillments);
  const all = raw ? (JSON.parse(raw) as Record<string, RewardFulfillment[]>) : {};
  all[userId] = fulfillments;
  localStorage.setItem(KEYS.rewardFulfillments, JSON.stringify(all));
}
