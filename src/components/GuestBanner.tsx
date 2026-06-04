import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';

export function GuestBanner() {
  const user = useAppStore((s) => s.user);
  const { t } = useLocale();
  if (user) return null;

  return (
    <div className="mb-4 rounded-xl border border-bc-accent/25 bg-bc-accent/10 px-3 py-2 text-sm">
      <p className="text-bc-muted">{t.guest.hint}</p>
      <Link to="/anmelden" className="mt-1 inline-block font-medium text-bc-accent">
        {t.guest.login} →
      </Link>
    </div>
  );
}
