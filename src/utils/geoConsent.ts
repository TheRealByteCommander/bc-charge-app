const CONSENT_KEY = 'bc_geo_consent';

export type GeoConsentStatus = 'granted' | 'denied' | null;

export function getGeoConsent(): GeoConsentStatus {
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === '1') return 'granted';
  if (v === '0') return 'denied';
  return null;
}

export function setGeoConsentGranted(): void {
  localStorage.setItem(CONSENT_KEY, '1');
}

export function setGeoConsentDenied(): void {
  localStorage.setItem(CONSENT_KEY, '0');
}

/** Widerruf: Einwilligung löschen, Banner erscheint erneut. */
export function revokeGeoConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
}
