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
  defaultAccessibilityPrefs,
  type AccessibilityPrefs,
  type FontScale,
} from '../types/a11y';

const STORAGE_KEY = 'bc_a11y_prefs';

function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAccessibilityPrefs();
    const parsed = JSON.parse(raw) as Partial<AccessibilityPrefs>;
    const base = defaultAccessibilityPrefs();
    return {
      fontScale:
        parsed.fontScale === 'large' || parsed.fontScale === 'xlarge'
          ? parsed.fontScale
          : base.fontScale,
      highContrast: Boolean(parsed.highContrast),
      simpleMode: Boolean(parsed.simpleMode),
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return defaultAccessibilityPrefs();
  }
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
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    applyToDocument(next);
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
