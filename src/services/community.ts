import { asArrayOf, isPlainObject, safeParseJson } from '../utils/safeJson';

export type ReportCategory = 'defect' | 'blocked' | 'offline_wrong' | 'price_wrong' | 'other';

export interface StationReport {
  id: string;
  stationId: string;
  category: ReportCategory;
  message: string;
  photoBase64?: string;
  createdAt: string;
  helpfulVotes: number;
}

const REPORTS_KEY = 'bc_station_reports';

const REPORT_CATEGORIES = new Set<ReportCategory>([
  'defect',
  'blocked',
  'offline_wrong',
  'price_wrong',
  'other',
]);

function isReportCategory(value: unknown): value is ReportCategory {
  return typeof value === 'string' && REPORT_CATEGORIES.has(value as ReportCategory);
}

/** Narrow unknown localStorage rows to StationReport (drop corrupt / partial entries). */
export function isStationReport(value: unknown): value is StationReport {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.stationId !== 'string' || !value.stationId) return false;
  if (!isReportCategory(value.category)) return false;
  if (typeof value.message !== 'string') return false;
  if (typeof value.createdAt !== 'string' || !value.createdAt) return false;
  if (typeof value.helpfulVotes !== 'number' || !Number.isFinite(value.helpfulVotes)) return false;
  if (value.photoBase64 !== undefined && typeof value.photoBase64 !== 'string') return false;
  return true;
}

function loadReports(): StationReport[] {
  const parsed = safeParseJson<unknown>(localStorage.getItem(REPORTS_KEY), []);
  return asArrayOf(parsed, isStationReport);
}

function saveReports(reports: StationReport[]): void {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    /* quota / private mode */
  }
}

export function getReportsForStation(stationId: string): StationReport[] {
  return loadReports()
    .filter((r) => r.stationId === stationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addStationReport(params: {
  stationId: string;
  category: ReportCategory;
  message: string;
  photoBase64?: string;
}): StationReport {
  const report: StationReport = {
    id: `rep_${Date.now()}`,
    stationId: params.stationId,
    category: params.category,
    message: params.message.trim(),
    photoBase64: params.photoBase64,
    createdAt: new Date().toISOString(),
    helpfulVotes: 0,
  };
  const all = loadReports();
  all.push(report);
  saveReports(all.slice(-500));
  return report;
}

/** PlugScore 0–10: Basis-Rating minus Community-Abzüge (Demo-Heuristik). */
export function computePlugScore(stationId: string, baseRating: number, reviewCount: number): number {
  const reports = getReportsForStation(stationId);
  const penalty = Math.min(3, reports.length * 0.35);
  const recentBad = reports.filter((r) => r.category !== 'other').length;
  const extra = Math.min(1.5, recentBad * 0.25);
  const reviewBoost = Math.min(0.5, reviewCount / 200);
  const score = baseRating * 2 - penalty - extra + reviewBoost;
  return Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;
}

export const reportCategoryLabels: Record<ReportCategory, { de: string; en: string }> = {
  defect: { de: 'Defekt / Kabel', en: 'Defect / cable' },
  blocked: { de: 'Zugang blockiert', en: 'Access blocked' },
  offline_wrong: { de: 'Status falsch', en: 'Wrong status' },
  price_wrong: { de: 'Preis falsch', en: 'Wrong price' },
  other: { de: 'Sonstiges', en: 'Other' },
};
