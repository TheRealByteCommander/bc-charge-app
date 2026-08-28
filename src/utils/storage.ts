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

/** Stable JSON compare for local demo blobs (key order from same constructors). */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Order-sensitive domain equality for local demo session lists.
 * Extends live meter/pricing equality with lifecycle/billing identity fields so
 * `saveSessions` can skip localStorage rewrites on identical demo ticks/retries.
 */
export function storedSessionsDomainEqual(
  a: readonly ChargingSession[] | null | undefined,
  b: readonly ChargingSession[] | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (!liveSessionMetricsEqual(x, y)) return false;
    if (
      x.startedAt !== y.startedAt ||
      x.endedAt !== y.endedAt ||
      x.vehicleId !== y.vehicleId ||
      x.paymentMethodId !== y.paymentMethodId ||
      x.stationName !== y.stationName ||
      x.connectorType !== y.connectorType ||
      x.invoiceNumber !== y.invoiceNumber ||
      x.citrineosTransactionId !== y.citrineosTransactionId ||
      x.billingStatus !== y.billingStatus ||
      x.paymentStatus !== y.paymentStatus
    ) {
      return false;
    }
  }
  return true;
}

/** Order-sensitive string-id list equality (redeemed rewards). */
export function storedStringIdsEqual(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
  try {
    // Demo/local profile path: skip rewrite when domain snapshot unchanged
    // (same family as active-session / offline-station equal-skip).
    const existing = loadUsers();
    if (jsonEqual(existing, users)) return;
    localStorage.setItem(KEYS.users, JSON.stringify(users));
  } catch {
    try {
      localStorage.setItem(KEYS.users, JSON.stringify(users));
    } catch {
      /* quota / private mode */
    }
  }
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
  try {
    const raw = localStorage.getItem(KEYS.sessions);
    const all = asRecordOfArrays<unknown>(safeParseJson(raw, {}));
    const prev = parseStoredSessions(all[userId] ?? []);
    // Local demo tick/retry: identical domain list must not touch localStorage.
    if (storedSessionsDomainEqual(prev, sessions)) return;
    all[userId] = sessions;
    localStorage.setItem(KEYS.sessions, JSON.stringify(all));
  } catch {
    try {
      const all = asRecordOfArrays<unknown>(
        safeParseJson(localStorage.getItem(KEYS.sessions), {})
      );
      all[userId] = sessions;
      localStorage.setItem(KEYS.sessions, JSON.stringify(all));
    } catch {
      /* quota / private mode */
    }
  }
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
  try {
    const all = asRecordOfArrays<unknown>(
      safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
    );
    const prev = parseStoredRedeemedIds(all[userId] ?? []);
    if (storedStringIdsEqual(prev, ids)) return;
    all[userId] = ids;
    localStorage.setItem(KEYS.redeemedRewards, JSON.stringify(all));
  } catch {
    try {
      const all = asRecordOfArrays<unknown>(
        safeParseJson(localStorage.getItem(KEYS.redeemedRewards), {})
      );
      all[userId] = ids;
      localStorage.setItem(KEYS.redeemedRewards, JSON.stringify(all));
    } catch {
      /* quota / private mode */
    }
  }
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
  try {
    const all = asRecordOfArrays<unknown>(
      safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
    );
    const prev = parseStoredFulfillments(all[userId] ?? []);
    if (jsonEqual(prev, fulfillments)) return;
    all[userId] = fulfillments;
    localStorage.setItem(KEYS.rewardFulfillments, JSON.stringify(all));
  } catch {
    try {
      const all = asRecordOfArrays<unknown>(
        safeParseJson(localStorage.getItem(KEYS.rewardFulfillments), {})
      );
      all[userId] = fulfillments;
      localStorage.setItem(KEYS.rewardFulfillments, JSON.stringify(all));
    } catch {
      /* quota / private mode */
    }
  }
}
