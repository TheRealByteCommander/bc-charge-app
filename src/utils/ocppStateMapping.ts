/**
 * OCPP State Mapping für CitrineOS Translation Layer
 * 
 * Der Elinta H2 nutzt OCPP 1.6J, während die App für OCPP 2.0.1 gebaut ist.
 * CitrineOS übersetzt automatisch, aber diese Utility stellt sicher, dass
 * alle States korrekt in der UI angezeigt werden.
 */

import type { ConnectorStatus } from '../types';

/** OCPP 1.6 Connector Status Values */
export type Ocpp16ConnectorStatus =
  | 'Available'
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEVSE'
  | 'SuspendedEV'
  | 'Finishing'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted';

/** OCPP 2.0.1 Charging State Values */
export type Ocpp201ChargingState =
  | 'Idle'
  | 'EVConnected'
  | 'Charging'
  | 'SuspendedEVSE'
  | 'SuspendedEV';

/** OCPP 2.0.1 Connector Status Values */
export type Ocpp201ConnectorStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted';

/** UI-freundliche Lade-Status-Beschreibung */
export interface ChargingStateInfo {
  status: ConnectorStatus;
  label: string;
  description: string;
  isCharging: boolean;
  isPaused: boolean;
}

/**
 * Einheitliches Mapping für OCPP-1.6- und 2.0.1-Statuswerte (z. B. go-e „Preparing“).
 */
export function mapUnifiedOcppConnectorStatusToApp(status: string): ConnectorStatus {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, '');

  if (normalized === 'available' || normalized === 'idle') return 'available';
  if (normalized === 'reserved') return 'reserved';
  if (
    [
      'occupied',
      'preparing',
      'charging',
      'suspendedevse',
      'suspendedev',
      'finishing',
      'evconnected',
    ].includes(normalized)
  ) {
    return 'occupied';
  }
  if (normalized === 'unavailable' || normalized === 'faulted') return 'offline';

  return 'offline';
}

/**
 * Mappt OCPP 1.6 Connector Status auf App ConnectorStatus
 */
export function mapOcpp16StatusToApp(status: string): ConnectorStatus {
  return mapUnifiedOcppConnectorStatusToApp(status);
}

/**
 * Mappt OCPP 2.0.1 Connector Status auf App ConnectorStatus
 */
export function mapOcpp201StatusToApp(status: string): ConnectorStatus {
  return mapUnifiedOcppConnectorStatusToApp(status);
}

/** Remote-Start möglich: frei oder Fahrzeug angesteckt (Preparing/EVConnected). */
export function isConnectorStartable(status: ConnectorStatus, rawOcppStatus?: string | null): boolean {
  if (isConnectorActivelyCharging(rawOcppStatus)) return false;
  return status === 'available' || status === 'occupied';
}

/** Aktiv ladend – kein erneuter Start. */
export function isConnectorActivelyCharging(rawStatus?: string | null): boolean {
  const normalized = String(rawStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, '');
  return normalized === 'charging';
}

/**
 * Liefert detaillierte Lade-Status-Informationen für die UI
 */
export function getChargingStateInfo(chargingState?: string | null): ChargingStateInfo {
  const state = (chargingState ?? '').toLowerCase();
  
  switch (state) {
    case 'idle':
      return {
        status: 'available',
        label: 'Bereit',
        description: 'Fahrzeug kann angeschlossen werden',
        isCharging: false,
        isPaused: false,
      };
    
    case 'evconnected':
      return {
        status: 'occupied',
        label: 'Verbunden',
        description: 'Fahrzeug angeschlossen, Ladevorgang startet',
        isCharging: false,
        isPaused: false,
      };
    
    case 'charging':
      return {
        status: 'occupied',
        label: 'Lädt',
        description: 'Ladevorgang aktiv',
        isCharging: true,
        isPaused: false,
      };
    
    case 'suspendedevse':
      return {
        status: 'occupied',
        label: 'Pausiert (Station)',
        description: 'Laden pausiert durch Ladestation (z.B. Lastmanagement)',
        isCharging: false,
        isPaused: true,
      };
    
    case 'suspendedev':
      return {
        status: 'occupied',
        label: 'Pausiert (Fahrzeug)',
        description: 'Laden pausiert durch Fahrzeug (z.B. Akku voll)',
        isCharging: false,
        isPaused: true,
      };
    
    case 'preparing':
      return {
        status: 'occupied',
        label: 'Vorbereitung',
        description: 'Ladevorgang wird vorbereitet',
        isCharging: false,
        isPaused: false,
      };
    
    case 'finishing':
      return {
        status: 'occupied',
        label: 'Beendet',
        description: 'Ladevorgang abgeschlossen, Fahrzeug kann abgesteckt werden',
        isCharging: false,
        isPaused: false,
      };
    
    default:
      return {
        status: 'offline',
        label: 'Unbekannt',
        description: 'Status nicht verfügbar',
        isCharging: false,
        isPaused: false,
      };
  }
}

/**
 * Prüft ob ein OCPP-Status als "aktiv ladend" gilt
 */
export function isActivelyCharging(chargingState?: string | null): boolean {
  return getChargingStateInfo(chargingState).isCharging;
}

/**
 * Prüft ob ein OCPP-Status als "pausiert" gilt
 */
export function isChargingPaused(chargingState?: string | null): boolean {
  return getChargingStateInfo(chargingState).isPaused;
}
