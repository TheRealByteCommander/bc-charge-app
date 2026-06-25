import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bc_install_dismissed_until';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed(): boolean {
  const until = sessionStorage.getItem(DISMISS_KEY);
  if (!until) return false;
  return Date.now() < Number(until);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(isDismissed() || isStandalone());

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (hidden || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setDeferred(null);
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setHidden(true);
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[55] mx-auto max-w-lg safe-bottom">
      <div className="flex items-start gap-3 rounded-2xl border border-bc-accent/40 bg-bc-elevated p-4 shadow-glow">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bc-accent/20 text-bc-accent">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">BC Charge installieren</p>
          <p className="mt-1 text-sm text-bc-muted">
            Schneller Zugriff vom Startbildschirm – wie eine native App.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary flex-1 py-2 text-sm" onClick={install}>
              Installieren
            </button>
            <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={dismiss}>
              Später
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-bc-muted hover:text-bc-text"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
