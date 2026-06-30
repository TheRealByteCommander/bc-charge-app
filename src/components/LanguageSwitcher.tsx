import { Globe } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/messages';

const languages: { code: Locale; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-3">
      <Globe className="h-5 w-5 text-bc-accent" />
      <div className="flex flex-1 gap-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLocale(lang.code)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              locale === lang.code
                ? 'bg-bc-accent/20 text-bc-accent'
                : 'bg-bc-surface text-bc-muted hover:bg-bc-border'
            }`}
          >
            <span className="mr-1.5">{lang.flag}</span>
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
