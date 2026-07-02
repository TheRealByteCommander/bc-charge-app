import type { Station } from '../types';

/**
 * Statische Fallback-Stationen (nur wenn CitrineOS nicht erreichbar).
 * In Produktion mit Live-Daten: Leeres Array – alle Stationen kommen aus CitrineOS.
 */
export const staticStations: Station[] = [];
