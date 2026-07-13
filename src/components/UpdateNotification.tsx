import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onServiceWorkerUpdate, skipWaitingAndReload } from '../utils/registerServiceWorker';
import { useLocale } from '../i18n/LocaleContext';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const { locale } = useLocale();

  useEffect(() => {
    onServiceWorkerUpdate(() => {
      setShowUpdate(true);
    });
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="glass flex items-center gap-3 rounded-2xl p-4 shadow-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-bc-accent" />
        <div className="flex-1">
          <p className="text-sm font-medium text-bc-text">
            {locale === 'de' ? 'Update verfügbar' : 'Update available'}
          </p>
          <p className="text-xs text-bc-muted">
            {locale === 'de'
              ? 'Eine neue Version der App ist bereit.'
              : 'A new version of the app is ready.'}
          </p>
        </div>
        <button
          type="button"
          onClick={skipWaitingAndReload}
          className="shrink-0 rounded-lg bg-bc-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {locale === 'de' ? 'Aktualisieren' : 'Update'}
        </button>
        <button
          type="button"
          onClick={() => setShowUpdate(false)}
          className="shrink-0 p-1 text-bc-muted hover:text-bc-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
