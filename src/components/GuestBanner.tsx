import { QrCode, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';

export function GuestBanner() {
  const user = useAppStore((s) => s.user);
  const { t, locale } = useLocale();
  if (user) return null;
  const de = locale === 'de';

  return (
    <div className="mb-4 rounded-2xl border border-bc-accent/30 bg-gradient-to-br from-bc-accent/15 via-bc-elevated to-bc-surface px-4 py-3 text-sm shadow-card">
      <p className="font-semibold text-bc-text">
        {de ? 'Ohne Konto unterwegs?' : 'Browsing as guest?'}
      </p>
      <p className="mt-1 text-bc-muted">{t.guest.hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/anmelden"
          className="inline-flex items-center gap-1.5 rounded-full bg-bc-accent px-3 py-1.5 text-xs font-bold text-bc-ink"
        >
          <UserRound className="h-3.5 w-3.5" />
          {t.guest.login}
        </Link>
        <Link
          to="/scan"
          className="inline-flex items-center gap-1.5 rounded-full border border-bc-border bg-bc-elevated px-3 py-1.5 text-xs font-semibold text-bc-text"
        >
          <QrCode className="h-3.5 w-3.5 text-bc-accent" />
          {de ? 'Ad-Hoc per QR' : 'Ad-hoc via QR'}
        </Link>
        <Link to="/hilfe" className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-bc-accent">
          {t.guest.help} →
        </Link>
      </div>
    </div>
  );
}
