import { useMemo, useState } from 'react';
import {
  helpFaqs,
  helpFaqCategoryLabels,
  type HelpFaqCategory,
} from '../../data/helpContent';
import { useLocale } from '../../i18n/LocaleContext';

export function HelpFaqList() {
  const { locale, t } = useLocale();
  const [category, setCategory] = useState<HelpFaqCategory>('all');

  const filtered = useMemo(
    () => (category === 'all' ? helpFaqs : helpFaqs.filter((f) => f.category === category)),
    [category]
  );

  const categories: HelpFaqCategory[] = ['all', 'charging', 'payment', 'account', 'technical'];

  return (
    <section id="hilfe-faq" className="scroll-mt-24">
      <h2 className="font-display font-semibold">{t.help.faqTitle}</h2>
      <p className="mt-1 text-sm text-bc-muted">{t.help.faqHint}</p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t.help.faqFilterLabel}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              category === cat
                ? 'bg-bc-accent text-white'
                : 'border border-bc-border bg-bc-elevated text-bc-muted hover:text-bc-text'
            }`}
          >
            {helpFaqCategoryLabels[cat][locale]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((faq) => (
          <details key={faq.id} className="group rounded-xl border border-bc-border bg-bc-elevated">
            <summary className="cursor-pointer px-4 py-3 font-medium marker:content-none">
              <span className="flex items-center justify-between gap-2">
                {faq.question[locale]}
                <span className="text-bc-muted transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <p className="border-t border-bc-border px-4 py-3 text-sm leading-relaxed text-bc-muted">
              {faq.answer[locale]}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
