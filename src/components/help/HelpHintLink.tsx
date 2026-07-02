import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleContext';

export function HelpHintLink({
  hash,
  className = '',
}: {
  hash?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const to = hash ? `/hilfe${hash}` : '/hilfe';

  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-sm font-medium text-bc-accent hover:underline ${className}`}
    >
      <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
      {t.help.needHelp}
    </Link>
  );
}
