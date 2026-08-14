import { asArrayOf, isPlainObject, safeParseJson } from '../utils/safeJson';

export type CheckInStatus = 'available' | 'busy' | 'broken' | 'charging_ok';

export interface StationCheckIn {
  id: string;
  stationId: string;
  status: CheckInStatus;
  note?: string;
  createdAt: string;
}

const CHECKINS_KEY = 'bc_station_checkins';
const MAX_STORED = 800;

const STATUS_SET = new Set<CheckInStatus>(['available', 'busy', 'broken', 'charging_ok']);

function isCheckInStatus(value: unknown): value is CheckInStatus {
  return typeof value === 'string' && STATUS_SET.has(value as CheckInStatus);
}

export function isStationCheckIn(value: unknown): value is StationCheckIn {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.stationId !== 'string' || !value.stationId) return false;
  if (!isCheckInStatus(value.status)) return false;
  if (typeof value.createdAt !== 'string' || !value.createdAt) return false;
  if (value.note !== undefined && typeof value.note !== 'string') return false;
  return true;
}

function loadAll(): StationCheckIn[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem(CHECKINS_KEY), []);
  return asArrayOf(parsed, isStationCheckIn);
}

function saveAll(rows: StationCheckIn[]): void {
  try {
    localStorage.setItem(CHECKINS_KEY, JSON.stringify(rows.slice(-MAX_STORED)));
  } catch {
    /* quota / private mode */
  }
}

export function getCheckInsForStation(stationId: string): StationCheckIn[] {
  // Newest first; stable on identical timestamps via id (monotonic prefix + random suffix).
  return loadAll()
    .filter((c) => c.stationId === stationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

const MAX_NOTE_LEN = 200;

export function addStationCheckIn(params: {
  stationId: string;
  status: CheckInStatus;
  note?: string;
}): StationCheckIn {
  const stationId = typeof params.stationId === 'string' ? params.stationId.trim() : '';
  if (!stationId) {
    throw new Error('stationId required');
  }
  if (!isCheckInStatus(params.status)) {
    throw new Error('invalid check-in status');
  }
  let note: string | undefined;
  if (typeof params.note === 'string') {
    const trimmed = params.note.trim();
    if (trimmed) note = trimmed.slice(0, MAX_NOTE_LEN);
  }
  const row: StationCheckIn = {
    id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    stationId,
    status: params.status,
    note,
    createdAt: new Date().toISOString(),
  };
  const all = loadAll();
  all.push(row);
  saveAll(all);
  return row;
}

/** Rolling reliability summary from local check-ins (last 30 days). */
export function getStationReliabilitySummary(stationId: string): {
  total: number;
  last7d: number;
  positiveRate: number | null;
  lastStatus: CheckInStatus | null;
  lastAt: string | null;
  labelDe: string;
  labelEn: string;
} {
  const all = getCheckInsForStation(stationId);
  const now = Date.now();
  const day = 86_400_000;
  const withValidTs = all.filter((c) => Number.isFinite(new Date(c.createdAt).getTime()));
  const last30 = withValidTs.filter((c) => now - new Date(c.createdAt).getTime() <= 30 * day);
  const last7 = last30.filter((c) => now - new Date(c.createdAt).getTime() <= 7 * day);
  const positive = last30.filter((c) => c.status === 'available' || c.status === 'charging_ok');
  const positiveRate =
    last30.length > 0 ? Math.round((positive.length / last30.length) * 100) : null;
  const last = all[0] ?? null;

  let labelDe = 'Noch keine Check-ins';
  let labelEn = 'No check-ins yet';
  if (positiveRate != null) {
    if (positiveRate >= 80) {
      labelDe = `${positiveRate}% positiv · oft zuverlässig`;
      labelEn = `${positiveRate}% positive · often reliable`;
    } else if (positiveRate >= 50) {
      labelDe = `${positiveRate}% positiv · gemischt`;
      labelEn = `${positiveRate}% positive · mixed`;
    } else {
      labelDe = `${positiveRate}% positiv · Vorsicht`;
      labelEn = `${positiveRate}% positive · caution`;
    }
  }

  return {
    total: last30.length,
    last7d: last7.length,
    positiveRate,
    lastStatus: last?.status ?? null,
    lastAt: last?.createdAt ?? null,
    labelDe,
    labelEn,
  };
}

export const checkInStatusLabels: Record<CheckInStatus, { de: string; en: string }> = {
  available: { de: 'Frei & ok', en: 'Free & ok' },
  busy: { de: 'Besetzt', en: 'Busy' },
  broken: { de: 'Defekt / Problem', en: 'Broken / issue' },
  charging_ok: { de: 'Lädt gut', en: 'Charging fine' },
};
