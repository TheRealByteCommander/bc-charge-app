import { ShieldCheck } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { getStationReliabilitySummary } from '../services/stationCheckIn';

export function StationReliabilityBadge({
  stationId,
  compact = false,
}: {
  stationId: string;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const de = locale === 'de';
  const s = getStationReliabilitySummary(stationId);
  if (s.total === 0) return null;

  const tone =
    s.positiveRate != null && s.positiveRate >= 80
      ? 'text-bc-accent border-bc-accent/30 bg-bc-accent/10'
      : s.positiveRate != null && s.positiveRate >= 50
        ? 'text-bc-warn border-bc-warn/30 bg-bc-warn/10'
        : 'text-bc-danger border-bc-danger/30 bg-bc-danger/10';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
        title={de ? s.labelDe : s.labelEn}
      >
        <ShieldCheck className="h-3 w-3" />
        {s.positiveRate}%
      </span>
    );
  }

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}>
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{de ? 'Community-Zuverlässigkeit' : 'Community reliability'}</p>
        <p className="text-xs opacity-90">{de ? s.labelDe : s.labelEn}</p>
      </div>
    </div>
  );
}
