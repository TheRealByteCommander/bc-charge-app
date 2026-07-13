import { Link } from 'react-router-dom';
import type { HelpGuideId } from '../../data/helpContent';
import { useLocale } from '../../i18n/LocaleContext';

const jumpLinks: { id: HelpGuideId | 'faq' | 'kontakt'; labelKey: 'jumpAccount' | 'jumpGuest' | 'jumpQr' | 'jumpFaq' | 'jumpContact' }[] = [
  { id: 'account-charge', labelKey: 'jumpAccount' },
  { id: 'guest-charge', labelKey: 'jumpGuest' },
  { id: 'qr-scan', labelKey: 'jumpQr' },
  { id: 'faq', labelKey: 'jumpFaq' },
  { id: 'kontakt', labelKey: 'jumpContact' },
];

export function HelpQuickNav() {
  const { t } = useLocale();

  const labels = {
    jumpAccount: t.help.jumpAccount,
    jumpGuest: t.help.jumpGuest,
    jumpQr: t.help.jumpQr,
    jumpFaq: t.help.jumpFaq,
    jumpContact: t.help.jumpContact,
  } as const;

  return (
    <nav aria-label={t.help.quickNavLabel} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {jumpLinks.map((item) => {
        const href = item.id === 'faq' ? '#hilfe-faq' : item.id === 'kontakt' ? '#hilfe-kontakt' : `#hilfe-${item.id}`;
        if (item.id === 'faq' || item.id === 'kontakt') {
          return (
            <a
              key={item.id}
              href={href}
              className="shrink-0 rounded-full border border-bc-border bg-bc-elevated px-3 py-1.5 text-xs font-medium text-bc-muted transition hover:border-bc-accent/40 hover:text-bc-accent"
            >
              {labels[item.labelKey]}
            </a>
          );
        }
        return (
          <a
            key={item.id}
            href={href}
            className="shrink-0 rounded-full border border-bc-border bg-bc-elevated px-3 py-1.5 text-xs font-medium text-bc-muted transition hover:border-bc-accent/40 hover:text-bc-accent"
          >
            {labels[item.labelKey]}
          </a>
        );
      })}
      <Link
        to="/barrierefreiheit"
        className="shrink-0 rounded-full border border-bc-border bg-bc-elevated px-3 py-1.5 text-xs font-medium text-bc-muted transition hover:border-bc-accent/40 hover:text-bc-accent"
      >
        {t.help.jumpAccessibility}
      </Link>
    </nav>
  );
}
