import type { ChargingSession, UserProfile } from '../types';
import { loadRedeemed, loadSessions, loadUsers } from './storage';

export const LOCAL_STORAGE_DISCLOSURE = [
  { key: 'bc_users', purpose: 'Kontodaten (Profil, Einstellungen)', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_current_user', purpose: 'Angemeldeter Nutzer', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_sessions', purpose: 'Ladehistorie', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_redeemed', purpose: 'Eingelöste Prämien', legal: 'Art. 6 Abs. 1 lit. b DSGVO' },
  { key: 'bc_onboarding_done', purpose: 'App-Einführung abgeschlossen', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_geo_consent', purpose: 'Einwilligung Standort', legal: 'Art. 6 Abs. 1 lit. a DSGVO' },
  { key: 'bc_locale', purpose: 'Spracheinstellung', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_stations_offline_v1', purpose: 'Offline-Karte (technisch)', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
  { key: 'bc_station_reports', purpose: 'Community-Meldungen zu Stationen', legal: 'Art. 6 Abs. 1 lit. f DSGVO' },
] as const;

function loadStationReports(): unknown[] {
  try {
    const raw = localStorage.getItem('bc_station_reports');
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}

function sanitizeUserForExport(user: UserProfile) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

export function buildUserDataExport(userId: string): Record<string, unknown> {
  const user = loadUsers().find((u) => u.id === userId);
  if (!user) throw new Error('Kein Nutzer gefunden');

  return {
    exportedAt: new Date().toISOString(),
    format: 'BC Charge Datenexport (Art. 20 DSGVO)',
    profile: sanitizeUserForExport(user),
    sessions: loadSessions(userId),
    redeemedRewards: loadRedeemed(userId),
    stationReports: loadStationReports(),
    note: 'Passwörter werden aus Sicherheitsgründen nicht exportiert. Zahlungsdaten liegen bei Stripe.',
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

/** Alle lokalen Daten eines Nutzers entfernen (Art. 17 – Gerätespeicher). */
export function purgeUserLocalData(userId: string): void {
  const users = loadUsers().filter((u) => u.id !== userId);
  localStorage.setItem('bc_users', JSON.stringify(users));

  const sessionsRaw = localStorage.getItem('bc_sessions');
  if (sessionsRaw) {
    const all = JSON.parse(sessionsRaw) as Record<string, ChargingSession[]>;
    delete all[userId];
    localStorage.setItem('bc_sessions', JSON.stringify(all));
  }

  const redeemedRaw = localStorage.getItem('bc_redeemed');
  if (redeemedRaw) {
    const all = JSON.parse(redeemedRaw) as Record<string, string[]>;
    delete all[userId];
    localStorage.setItem('bc_redeemed', JSON.stringify(all));
  }
}
