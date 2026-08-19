import type { ChargingSession, UserProfile } from '../types';
import { asRecordOfArrays, safeParseJson } from './safeJson';
import {
  clearActiveSessionCache,
  loadActiveSessionCache,
  loadFulfillments,
  loadRedeemed,
  loadSessions,
  loadUsers,
} from './storage';

export const LOCAL_STORAGE_DISCLOSURE = [
  { key: 'bc_users', purpose: 'Kontodaten (Profil, Einstellungen)', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_current_user', purpose: 'Angemeldeter Nutzer', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_sessions', purpose: 'Ladehistorie', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_redeemed', purpose: 'Eingelöste Prämien', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_reward_fulfillments', purpose: 'Prämien-Einlösungen / Gutscheine', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_active_session_cache', purpose: 'Aktive Ladesession (Resume, sessionStorage)', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_onboarding_done', purpose: 'App-Einführung abgeschlossen', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_geo_consent', purpose: 'Einwilligung Standort', legal: 'Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG' },
  { key: 'bc_locale', purpose: 'Spracheinstellung', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_a11y_prefs', purpose: 'Barrierefreiheits-Einstellungen', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_stations_offline_v1', purpose: 'Offline-Karte (technisch)', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_station_reports', purpose: 'Community-Meldungen zu Stationen (gerätelokal, ohne User-ID)', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
] as const;

function loadStationReports(): unknown[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem('bc_station_reports'), []);
  return Array.isArray(parsed) ? parsed : [];
}

function sanitizeUserForExport(user: UserProfile) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

export function buildUserDataExport(userId: string): Record<string, unknown> {
  const user = loadUsers().find((u) => u.id === userId);
  if (!user) throw new Error('Kein Nutzer gefunden');

  const activeSessionCache = loadActiveSessionCache(userId);

  return {
    exportedAt: new Date().toISOString(),
    format: 'BC Charge Datenexport (Art. 20 DSGVO)',
    profile: sanitizeUserForExport(user),
    sessions: loadSessions(userId),
    redeemedRewards: loadRedeemed(userId),
    rewardFulfillments: loadFulfillments(userId),
    activeSessionCache: activeSessionCache
      ? {
          id: activeSessionCache.id,
          stationId: activeSessionCache.stationId,
          stationName: activeSessionCache.stationName,
          status: activeSessionCache.status,
          startedAt: activeSessionCache.startedAt,
          energyKwh: activeSessionCache.energyKwh,
          costEur: activeSessionCache.costEur,
        }
      : null,
    // Community reports are device-local and not keyed by userId — exported as device context only.
    stationReports: loadStationReports(),
    note: 'Passwörter werden aus Sicherheitsgründen nicht exportiert. Zahlungsdaten liegen bei Stripe. Community-Meldungen sind gerätelokal ohne Nutzerbezug.',
  };
}

export function downloadUserDataExport(userId: string): void {
  const payload = buildUserDataExport(userId);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bc-charge-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Remove all local (demo/offline) data for one user (Art. 17 – device storage).
 * Clears users/sessions/redeemed/fulfillments and the active-session resume cache
 * when it belongs to this user. Station reports stay (no userId on rows).
 */
export function purgeUserLocalData(userId: string): void {
  if (!userId) return;

  const users = loadUsers().filter((u) => u.id !== userId);
  localStorage.setItem('bc_users', JSON.stringify(users));

  const sessionsRaw = localStorage.getItem('bc_sessions');
  if (sessionsRaw) {
    const all = asRecordOfArrays<ChargingSession>(safeParseJson(sessionsRaw, {}));
    delete all[userId];
    localStorage.setItem('bc_sessions', JSON.stringify(all));
  }

  const redeemedRaw = localStorage.getItem('bc_redeemed');
  if (redeemedRaw) {
    const all = asRecordOfArrays<string>(safeParseJson(redeemedRaw, {}));
    delete all[userId];
    localStorage.setItem('bc_redeemed', JSON.stringify(all));
  }

  const fulfillmentsRaw = localStorage.getItem('bc_reward_fulfillments');
  if (fulfillmentsRaw) {
    const all = asRecordOfArrays<unknown>(safeParseJson(fulfillmentsRaw, {}));
    delete all[userId];
    localStorage.setItem('bc_reward_fulfillments', JSON.stringify(all));
  }

  // Resume cache is single-slot and user-scoped via envelope.userId.
  // Only clear when it belongs to the purged user so another logged-in profile is kept.
  const cached = loadActiveSessionCache(userId);
  if (cached) {
    clearActiveSessionCache();
  }

  try {
    if (localStorage.getItem('bc_current_user') === userId) {
      localStorage.removeItem('bc_current_user');
    }
  } catch {
    /* private mode */
  }
}
