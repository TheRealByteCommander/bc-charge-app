import type { ChargingSession, RewardFulfillment, UserProfile } from '../types';
import {
  ChargingSessionSchema,
  RewardFulfillmentSchema,
  UserProfileSchema,
  toChargingSession,
  toRewardFulfillment,
  toUserProfile,
} from '../api/backend/schemas';
import { asRecordOfArrays, isPlainObject, safeParseJson } from './safeJson';
import { liveSessionMetricsEqual } from './sessionLiveEqual';

const KEYS = {
  users: 'bc_users',
  currentUserId: 'bc_current_user',
  sessions: 'bc_sessions',
  onboarding: 'bc_onboarding_done',
  redeemedRewards: 'bc_redeemed',
  rewardFulfillments: 'bc_reward_fulfillments',
} as const;

/**
 * Parse-don't-cast for localStorage user list.
 * Corrupt / partial rows are dropped (never throw); valid rows are mapped to domain.
 * Exported for unit tests without touching real localStorage.
 */
export function parseStoredUsers(raw: string | null | undefined): UserProfile[] {
  const parsed = safeParseJson<unknown>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const out: UserProfile[] = [];
  for (const item of parsed) {
    const result = UserProfileSchema.safeParse(item);
    if (!result.success) continue;
    out.push(toUserProfile(result.data));
  }
  return out;
}

/**
 * Parse-don't-cast for one user's session list (local demo / offline store).
 * Non-array values and invalid rows are dropped.
 */
export function parseStoredSessions(raw: unknown): ChargingSession[] {
  if (!Array.isArray(raw)) return [];
  const out: ChargingSession[] = [];
  for (const item of raw) {
    const result = ChargingSessionSchema.safeParse(item);
    if (!result.success) continue;
    out.push(toChargingSession(result.data));
  }
  return out;
}

/**
 * Parse-don't-cast for one user's reward fulfillments.
 * Non-array values and invalid rows are dropped.
 */
export function parseStoredFulfillments(raw: unknown): RewardFulfillment[] {
  if (!Array.isArray(raw)) return [];
  const out: RewardFulfillment[] = [];
  for (const item of raw) {
    const result = RewardFulfillmentSchema.safeParse(item);
    if (!result.success) continue;
    out.push(toRewardFulfillment(result.data));
  }
  return out;
}

/** Keep only finite string reward ids (drop objects / null / empty). */
export function parseStoredRedeemedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item);
    else if (typeof item === 'number' && Number.isFinite(item)) out.push(String(item));
  }
  return out;
}

export function loadUsers(): UserProfile[] {
  try {
    return parseStoredUsers(localStorage.getItem(KEYS.users));
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
  if (!userId) return [];
  try {
    const all = asRecordOfArrays<unknown>(
      safeParseJson(localStorage.getItem(KEYS.sessions), {})
    );
    return parseStoredSessions(all[userId] ?? []);
  } catch {
    return [];
  }
}

export function saveSessions(userId: string, sessions: ChargingSession[]): void {
  if (!userId) return;
  const all = asRecordOfArrays<unknown>(
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
    // Skip rewrite when live meter/pricing fields are unchanged (ignore savedAt churn).
    // Complements tickSession's liveSessionMetricsEqual guard for other call sites
    // (refreshActiveSession / start paths) that still touch sessionStorage.
    const existing = parseActiveSessionCache(sessionStorage.getItem(ACTIVE_SESSION_CACHE), userId);
    if (existing && liveSessionMetricsEqual(existing, session)) return;

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
  if (!userId) return [];
  try {
    const all = asRecordOfArrays<unknown>(
      safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
    );
    return parseStoredRedeemedIds(all[userId] ?? []);
  } catch {
    return [];
  }
}

export function saveRedeemed(userId: string, ids: string[]): void {
  if (!userId) return;
  const all = asRecordOfArrays<unknown>(
    safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
  );
  all[userId] = ids;
  localStorage.setItem(KEYS.redeemedRewards, JSON.stringify(all));
}

export function loadFulfillments(userId: string): RewardFulfillment[] {
  if (!userId) return [];
  try {
    const all = asRecordOfArrays<unknown>(
      safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
    );
    return parseStoredFulfillments(all[userId] ?? []);
  } catch {
    return [];
  }
}

export function saveFulfillments(userId: string, fulfillments: RewardFulfillment[]): void {
  if (!userId) return;
  const all = asRecordOfArrays<unknown>(
    safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
  );
  all[userId] = fulfillments;
  localStorage.setItem(KEYS.rewardFulfillments, JSON.stringify(all));
}
