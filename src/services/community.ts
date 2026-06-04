export type ReportCategory = 'defect' | 'blocked' | 'offline_wrong' | 'price_wrong' | 'other';

export interface StationReport {
  id: string;
  stationId: string;
  category: ReportCategory;
  message: string;
  createdAt: string;
  helpfulVotes: number;
}

const REPORTS_KEY = 'bc_station_reports';

function loadReports(): StationReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as StationReport[]) : [];
  } catch {
    return [];
  }
}

function saveReports(reports: StationReport[]): void {
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
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
}): StationReport {
  const report: StationReport = {
    id: `rep_${Date.now()}`,
    stationId: params.stationId,
    category: params.category,
    message: params.message.trim(),
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
