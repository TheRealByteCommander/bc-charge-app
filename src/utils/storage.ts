import type { ChargingSession, RewardFulfillment, UserProfile } from '../types';
import {
  ChargingSessionSchema,
  toChargingSession,
} from '../api/backend/schemas';
import { asRecordOfArrays, isPlainObject, safeParseJson } from './safeJson';

const KEYS = {
  users: 'bc_users',
  currentUserId: 'bc_current_user',
  sessions: 'bc_sessions',
  onboarding: 'bc_onboarding_done',
  redeemedRewards: 'bc_redeemed',
  rewardFulfillments: 'bc_reward_fulfillments',
} as const;

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

/** Envelope shape for backend-mode active-session resume (sessionStorage). */
export type ActiveSessionCacheEnvelope = {
  userId: string;
  session: ChargingSession;
  savedAt: string;
};

/**
 * Parse-don't-cast for the active-session resume cache.
 * Corrupt / partial / wrong-user / non-active rows → null (never throw).
 * Exported for unit tests without touching real sessionStorage.
 */
export function parseActiveSessionCache(
  raw: string | null | undefined,
  userId: string
): ChargingSession | null {
  if (!userId) return null;
  const parsed = safeParseJson<unknown>(raw, null);
  if (!isPlainObject(parsed)) return null;
  if (parsed.userId !== userId) return null;
  if (!isPlainObject(parsed.session)) return null;

  const sessionParsed = ChargingSessionSchema.safeParse(parsed.session);
  if (!sessionParsed.success) return null;
  if (sessionParsed.data.status !== 'active') return null;

  return toChargingSession(sessionParsed.data);
}

/** Kurzzeit-Cache der aktiven Session (Backend-Modus) – Wiederherstellung bei App-Neustart. */
export function saveActiveSessionCache(userId: string, session: ChargingSession): void {
  if (!userId || !session?.id) return;
  try {
    const envelope: ActiveSessionCacheEnvelope = {
      userId,
      session,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(ACTIVE_SESSION_CACHE, JSON.stringify(envelope));
  } catch {
    /* Quota / private mode */
  }
}

export function loadActiveSessionCache(userId: string): ChargingSession | null {
  try {
    return parseActiveSessionCache(sessionStorage.getItem(ACTIVE_SESSION_CACHE), userId);
  } catch {
    // sessionStorage may throw in locked-down / private contexts
    return null;
  }
}

export function clearActiveSessionCache(): void {
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_CACHE);
  } catch {
    /* ignore */
  }
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
