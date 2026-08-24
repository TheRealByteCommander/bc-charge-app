export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AccessibilityPrefs {
  fontScale: FontScale;
  highContrast: boolean;
  simpleMode: boolean;
  reduceMotion: boolean;
}

export const defaultAccessibilityPrefs = (): AccessibilityPrefs => ({
  fontScale: 'normal',
  highContrast: false,
  simpleMode: false,
  reduceMotion: false,
});

/** True when both pref snapshots are field-equal (client localStorage no-op guard). */
export function accessibilityPrefsEqual(
  a: AccessibilityPrefs,
  b: AccessibilityPrefs
): boolean {
  return (
    a.fontScale === b.fontScale &&
    a.highContrast === b.highContrast &&
    a.simpleMode === b.simpleMode &&
    a.reduceMotion === b.reduceMotion
  );
}

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: 'Normal',
  large: 'Groß',
  xlarge: 'Sehr groß',
};
