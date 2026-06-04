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

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: 'Normal',
  large: 'Groß',
  xlarge: 'Sehr groß',
};
