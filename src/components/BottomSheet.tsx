import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

const SCROLL_ROOT_SELECTOR = '.page-shell';

function lockPageScroll(): () => void {
  const scrollRoots = Array.from(document.querySelectorAll<HTMLElement>(SCROLL_ROOT_SELECTOR));
  const saved = scrollRoots.map((el) => ({
    el,
    overflow: el.style.overflow,
    touchAction: el.style.touchAction,
  }));

  scrollRoots.forEach((el) => {
    el.style.overflow = 'hidden';
    el.style.touchAction = 'none';
  });

  const prevHtmlOverflow = document.documentElement.style.overflow;
  const prevBodyOverflow = document.body.style.overflow;
  const prevBodyTouchAction = document.body.style.touchAction;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';

  return () => {
    saved.forEach(({ el, overflow, touchAction }) => {
      el.style.overflow = overflow;
      el.style.touchAction = touchAction;
    });
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.touchAction = prevBodyTouchAction;
  };
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fixiert am unteren Rand – für primäre Aktionen (z. B. „Jetzt laden“). */
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Schließen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] touch-none bg-black/60"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bottom-sheet-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[71] mx-auto flex max-h-[85dvh] max-w-lg flex-col overflow-hidden rounded-t-3xl border border-bc-border bg-bc-elevated shadow-2xl safe-bottom"
            onTouchMove={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-bc-border px-4 py-3">
              <h2 id="bottom-sheet-title" className="font-display font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-bc-muted hover:bg-bc-surface hover:text-bc-text"
                aria-label="Schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4">
              {children}
            </div>
            {footer ? (
              <div className="shrink-0 border-t border-bc-border bg-bc-elevated p-4">{footer}</div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
