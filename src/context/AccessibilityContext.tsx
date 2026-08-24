import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  accessibilityPrefsEqual,
  defaultAccessibilityPrefs,
  type AccessibilityPrefs,
  type FontScale,
} from '../types/a11y';
import { isPlainObject, safeParseJson } from '../utils/safeJson';

const STORAGE_KEY = 'bc_a11y_prefs';

function loadPrefs(): AccessibilityPrefs {
  const base = defaultAccessibilityPrefs();
  const parsed = safeParseJson<unknown>(localStorage.getItem(STORAGE_KEY), null);
  if (!isPlainObject(parsed)) return base;
  return {
    fontScale:
      parsed.fontScale === 'large' || parsed.fontScale === 'xlarge'
        ? parsed.fontScale
        : base.fontScale,
    highContrast: Boolean(parsed.highContrast),
    simpleMode: Boolean(parsed.simpleMode),
    reduceMotion: Boolean(parsed.reduceMotion),
  };
}

function applyToDocument(prefs: AccessibilityPrefs) {
  const root = document.documentElement;
  root.dataset.a11yFont = prefs.fontScale;
  root.dataset.a11yContrast = prefs.highContrast ? 'high' : 'standard';
  root.dataset.a11ySimple = prefs.simpleMode ? 'true' : 'false';
  root.dataset.a11yMotion = prefs.reduceMotion ? 'reduced' : 'full';
}

const AccessibilityContext = createContext<{
  prefs: AccessibilityPrefs;
  setFontScale: (scale: FontScale) => void;
  setHighContrast: (on: boolean) => void;
  setSimpleMode: (on: boolean) => void;
  setReduceMotion: (on: boolean) => void;
  resetPrefs: () => void;
} | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(() => {
    const initial = loadPrefs();
    applyToDocument(initial);
    return initial;
  });

  const persist = useCallback((next: AccessibilityPrefs) => {
    setPrefs((prev) => {
      // Client no-op family: skip localStorage + document churn when toggled value equals current.
      if (accessibilityPrefsEqual(prev, next)) return prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
      applyToDocument(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyToDocument(prefs);
  }, [prefs]);

  const value = useMemo(
    () => ({
      prefs,
      setFontScale: (fontScale: FontScale) => persist({ ...prefs, fontScale }),
      setHighContrast: (highContrast: boolean) => persist({ ...prefs, highContrast }),
      setSimpleMode: (simpleMode: boolean) => persist({ ...prefs, simpleMode }),
      setReduceMotion: (reduceMotion: boolean) => persist({ ...prefs, reduceMotion }),
      resetPrefs: () => persist(defaultAccessibilityPrefs()),
    }),
    [prefs, persist]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility outside AccessibilityProvider');
  return ctx;
}
