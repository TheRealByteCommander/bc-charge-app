import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import {
  addStationReport,
  getReportsForStation,
  reportCategoryLabels,
  type ReportCategory,
} from '../services/community';
import { useLocale } from '../i18n/LocaleContext';

const CATEGORIES: ReportCategory[] = ['defect', 'blocked', 'offline_wrong', 'price_wrong', 'other'];

export function CommunityReportForm({ stationId, onSubmitted }: { stationId: string; onSubmitted?: () => void }) {
  const { locale } = useLocale();
  const [category, setCategory] = useState<ReportCategory>('defect');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const reports = getReportsForStation(stationId);

  const recordCommunityReport = useAppStore((s) => s.recordCommunityReport);

  const submit = () => {
    if (!message.trim()) return;
    addStationReport({ stationId, category, message });
    recordCommunityReport();
    setMessage('');
    setDone(true);
    onSubmitted?.();
  };

  return (
    <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
      <h2 className="font-display font-semibold">
        {locale === 'de' ? 'Community-Meldung' : 'Community report'}
      </h2>
      <p className="mt-1 text-xs text-bc-muted">
        {locale === 'de'
          ? 'Hilft anderen Fahrern und verbessert den PlugScore.'
          : 'Helps other drivers and improves PlugScore.'}
      </p>
      <select
        className="input-field mt-3"
        value={category}
        onChange={(e) => setCategory(e.target.value as ReportCategory)}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {reportCategoryLabels[c][locale]}
          </option>
        ))}
      </select>
      <textarea
        className="input-field mt-2 min-h-[80px]"
        placeholder={locale === 'de' ? 'Was ist los? (z. B. Kabel defekt)' : 'What is wrong?'}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="button" className="btn-primary mt-3 w-full py-2.5 text-sm" onClick={submit}>
        {locale === 'de' ? 'Meldung senden' : 'Submit report'}
      </button>
      {done && (
        <p className="mt-2 text-sm text-bc-accent">
          {locale === 'de' ? 'Danke für Ihre Meldung.' : 'Thanks for your report.'}
        </p>
      )}
      {reports.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-bc-border pt-3">
          {reports.slice(0, 5).map((r) => (
            <li key={r.id} className="text-xs text-bc-muted">
              <span className="font-medium text-bc-text">{reportCategoryLabels[r.category][locale]}</span>
              {r.message && ` – ${r.message}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
