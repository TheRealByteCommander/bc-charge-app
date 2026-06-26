import { ShieldCheck } from 'lucide-react';
import { getStationTrust, trustLevelStyles, type TrustLevel } from '../services/stationTrust';

export function StationTrustBadge({
  stationId,
  liveData,
  availableCount,
  offlineCount = 0,
  compact = false,
}: {
  stationId: string;
  liveData?: boolean;
  availableCount: number;
  offlineCount?: number;
  compact?: boolean;
}) {
  const trust = getStationTrust(stationId, { liveData, availableCount, offlineCount });
  const styles = trustLevelStyles[trust.level];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${styles.badge}`}
        title={trust.detailLabel}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {trust.shortLabel}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border border-bc-border bg-bc-elevated p-4 ${trustAccentBorder(trust.level)}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.badge}`}>
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-bc-muted">Vertrauens-Status</p>
          <p className="mt-1 font-medium text-bc-text">{trust.shortLabel}</p>
          <p className="mt-1 text-sm text-bc-muted">{trust.detailLabel}</p>
        </div>
      </div>
    </div>
  );
}

function trustAccentBorder(level: TrustLevel): string {
  if (level === 'verified') return 'border-bc-accent/30';
  if (level === 'caution') return 'border-bc-warn/30';
  return '';
}
