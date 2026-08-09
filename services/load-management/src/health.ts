import { LoadManager } from './services/LoadManager';
import { PricingService } from './services/pricing';

/**
 * Shared health helpers for the Load Manager service.
 * HTTP routes live in index.ts; this module holds injectable refs + snapshot builders.
 */

let loadManager: LoadManager | null = null;
let pricingService: PricingService | null = null;

export function setLoadManager(manager: LoadManager): void {
  loadManager = manager;
}

export function setPricingService(service: PricingService): void {
  pricingService = service;
}

export function getLoadManager(): LoadManager | null {
  return loadManager;
}

export function getPricingService(): PricingService | null {
  return pricingService;
}

export interface HealthSnapshot {
  status: 'healthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  stations: number;
  stationIds: string[];
  wsOpen: boolean;
  tariffPeriods: number;
  activeSessions: number;
  billableSessions: number;
}

export function buildHealthSnapshot(): HealthSnapshot {
  const stations = loadManager?.getStations() ?? [];
  const stationIds = loadManager?.getStationIds() ?? [];
  const wsOpen = loadManager?.isWebSocketOpen() ?? false;
  const tariffPeriods = pricingService?.getTariffPeriods().length ?? 0;
  const activeSessions = pricingService?.getActiveSessions().length ?? 0;
  const billableSessions = pricingService?.getBillableSessions().length ?? 0;

  return {
    status: wsOpen || stations.length === 0 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'load-manager',
    version: '1.0.0',
    uptime: process.uptime(),
    stations: stations.length,
    stationIds,
    wsOpen,
    tariffPeriods,
    activeSessions,
    billableSessions,
  };
}

export default {
  setLoadManager,
  setPricingService,
  getLoadManager,
  getPricingService,
  buildHealthSnapshot,
};
