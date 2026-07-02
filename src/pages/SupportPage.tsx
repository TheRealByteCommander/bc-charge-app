import { Link } from 'react-router-dom';
import { companyInfo } from '../data/company';
import { helpGuides } from '../data/helpContent';
import { HelpContactCards } from '../components/help/HelpContactCards';
import { HelpFaqList } from '../components/help/HelpFaqList';
import { HelpGuideList } from '../components/help/HelpGuideList';
import { HelpQuickNav } from '../components/help/HelpQuickNav';
import { LegalFooterLinks } from '../components/LegalPageLayout';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';

export function SupportPage() {
  const { t } = useLocale();
  const user = useAppStore((s) => s.user);

  return (
    <div className="page-shell pb-28">
      <Link
        to={user ? '/profil' : '/karte'}
        className="text-sm text-bc-accent"
      >
        ← {user ? t.help.backToProfile : t.help.backToMap}
      </Link>

      <h1 className="mt-4 font-display text-2xl font-bold">{t.help.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-bc-muted">{t.help.subtitle}</p>

      <div className="mt-6">
        <HelpQuickNav />
      </div>

      <section className="mt-8">
        <h2 className="font-display font-semibold">{t.help.guidesTitle}</h2>
        <p className="mt-1 text-sm text-bc-muted">{t.help.guidesHint}</p>
        <div className="mt-4">
          <HelpGuideList guides={helpGuides} />
        </div>
      </section>

      <section id="hilfe-kontakt" className="mt-10 scroll-mt-24">
        <h2 className="font-display font-semibold">{t.help.contactTitle}</h2>
        <p className="mt-1 text-sm text-bc-muted">
          {companyInfo.brand} · {companyInfo.supportHours}
        </p>
        <div className="mt-4">
          <HelpContactCards />
        </div>
      </section>

      <div className="mt-10">
        <HelpFaqList />
      </div>

      <a
        href={companyInfo.websitePublic}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary mt-8 block w-full text-center"
      >
        {t.help.websiteCta}
      </a>

      <LegalFooterLinks className="mt-8 border-t border-bc-border pt-6" />
    </div>
  );
}
