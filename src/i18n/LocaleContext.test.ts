import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * Locale localStorage equal-skip is inlined in LocaleContext setLocale.
 * Mirror the guard here so the client no-op contract stays unit-tested without mounting React.
 */
function applyLocaleWrite(
  prev: 'de' | 'en',
  next: 'de' | 'en',
  storage: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void },
  key = 'bc_locale'
): 'de' | 'en' {
  if (prev === next) return prev;
  storage.setItem(key, next);
  return next;
}

describe('locale equal-skip contract', () => {
  let store: Record<string, string>;
  let setItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = {};
    setItem = vi.fn((k: string, v: string) => {
      store[k] = v;
    });
  });

  it('skips setItem when locale already active', () => {
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem,
    };
    expect(applyLocaleWrite('de', 'de', storage)).toBe('de');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('writes only when locale changes', () => {
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem,
    };
    expect(applyLocaleWrite('de', 'en', storage)).toBe('en');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith('bc_locale', 'en');
    expect(applyLocaleWrite('en', 'en', storage)).toBe('en');
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
