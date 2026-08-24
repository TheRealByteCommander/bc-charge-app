import { describe, expect, it } from 'vitest';
import { accessibilityPrefsEqual, defaultAccessibilityPrefs } from './a11y';

describe('accessibilityPrefsEqual', () => {
  it('returns true for identical snapshots', () => {
    const a = defaultAccessibilityPrefs();
    const b = defaultAccessibilityPrefs();
    expect(accessibilityPrefsEqual(a, b)).toBe(true);
  });

  it('returns false when any field differs', () => {
    const base = defaultAccessibilityPrefs();
    expect(accessibilityPrefsEqual(base, { ...base, fontScale: 'large' })).toBe(false);
    expect(accessibilityPrefsEqual(base, { ...base, highContrast: true })).toBe(false);
    expect(accessibilityPrefsEqual(base, { ...base, simpleMode: true })).toBe(false);
    expect(accessibilityPrefsEqual(base, { ...base, reduceMotion: true })).toBe(false);
  });
});
