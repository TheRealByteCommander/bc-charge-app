import {
  ChevronDown,
  CreditCard,
  Gift,
  QrCode,
  Smartphone,
  UserCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { HelpGuide, HelpGuideId } from '../../data/helpContent';
import { useLocale } from '../../i18n/LocaleContext';

const guideIcons: Record<HelpGuideId, LucideIcon> = {
  'account-charge': UserCircle,
  'guest-charge': Zap,
  'qr-scan': QrCode,
  payment: CreditCard,
  points: Gift,
  pwa: Smartphone,
};

export function HelpGuideList({ guides }: { guides: HelpGuide[] }) {
  const { locale } = useLocale();
  const [openId, setOpenId] = useState<HelpGuideId | null>('account-charge');

  return (
    <div className="space-y-3">
      {guides.map((guide) => {
        const Icon = guideIcons[guide.id];
        const isOpen = openId === guide.id;
        return (
          <article
            key={guide.id}
            id={`hilfe-${guide.id}`}
            className="scroll-mt-24 overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated"
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 p-4 text-left"
              onClick={() => setOpenId(isOpen ? null : guide.id)}
              aria-expanded={isOpen}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bc-accent/15 text-bc-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold">{guide.title[locale]}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-bc-muted transition ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </span>
                <span className="mt-1 block text-sm text-bc-muted">{guide.summary[locale]}</span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-bc-border px-4 pb-4 pt-3">
                <ol className="space-y-2">
                  {guide.steps[locale].map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-bc-muted">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bc-accent/15 text-xs font-semibold text-bc-accent">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                {guide.link && (
                  <Link to={guide.link.to} className="btn-secondary mt-4 inline-block text-sm">
                    {guide.link.label[locale]} →
                  </Link>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
