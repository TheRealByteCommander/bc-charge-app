import type { ChargingSession, RewardFulfillment, UserProfile } from '../types';

const KEYS = {
  users: 'bc_users',
  currentUserId: 'bc_current_user',
  sessions: 'bc_sessions',
  onboarding: 'bc_onboarding_done',
  redeemedRewards: 'bc_redeemed',
  rewardFulfillments: 'bc_reward_fulfillments',
} as const;

/** Parse localStorage JSON without throwing; wrong shapes degrade to fallback. */
function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asRecordOfArrays<T>(value: unknown): Record<string, T[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, T[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v as T[];
  }
  return out;
}

export function loadUsers(): UserProfile[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem(KEYS.users), []);
  return Array.isArray(parsed) ? (parsed as UserProfile[]) : [];
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
  const all = asRecordOfArrays<ChargingSession>(
    safeParseJson(localStorage.getItem(KEYS.sessions), {})
  );
  return all[userId] ?? [];
}

export function saveSessions(userId: string, sessions: ChargingSession[]): void {
  const all = asRecordOfArrays<ChargingSession>(
    safeParseJson(localStorage.getItem(KEYS.sessions), {})
  );
  all[userId] = sessions;
  localStorage.setItem(KEYS.sessions, JSON.stringify(all));
}

const ACTIVE_SESSION_CACHE = 'bc_active_session_cache';

/** Kurzzeit-Cache der aktiven Session (Backend-Modus) – Wiederherstellung bei App-Neustart. */
export function saveActiveSessionCache(userId: string, session: ChargingSession): void {
  try {
    sessionStorage.setItem(
      ACTIVE_SESSION_CACHE,
      JSON.stringify({ userId, session, savedAt: new Date().toISOString() })
    );
  } catch {
    /* Quota / private mode */
  }
}

export function loadActiveSessionCache(userId: string): ChargingSession | null {
  const parsed = safeParseJson<{ userId?: string; session?: ChargingSession } | null>(
    sessionStorage.getItem(ACTIVE_SESSION_CACHE),
    null
  );
  if (!parsed?.session || parsed.userId !== userId || parsed.session.status !== 'active') {
    return null;
  }
  return parsed.session;
}

export function clearActiveSessionCache(): void {
  sessionStorage.removeItem(ACTIVE_SESSION_CACHE);
}

export function isOnboardingDone(): boolean {
  return localStorage.getItem(KEYS.onboarding) === '1';
}

export function setOnboardingDone(): void {
  localStorage.setItem(KEYS.onboarding, '1');
}

export function loadRedeemed(userId: string): string[] {
  const all = asRecordOfArrays<string>(
    safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
  );
  return all[userId] ?? [];
}

export function saveRedeemed(userId: string, ids: string[]): void {
  const all = asRecordOfArrays<string>(
    safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
  );
  all[userId] = ids;
  localStorage.setItem(KEYS.redeemedRewards, JSON.stringify(all));
}

export function loadFulfillments(userId: string): RewardFulfillment[] {
  const all = asRecordOfArrays<RewardFulfillment>(
    safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
  );
  return all[userId] ?? [];
}

export function saveFulfillments(userId: string, fulfillments: RewardFulfillment[]): void {
  const all = asRecordOfArrays<RewardFulfillment>(
    safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
  );
  all[userId] = fulfillments;
  localStorage.setItem(KEYS.rewardFulfillments, JSON.stringify(all));
}
