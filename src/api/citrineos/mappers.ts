import type {
  Connector,
  ConnectorStatus,
  ConnectorType,
  HardwareFeatures,
  KnownHardwareModel,
  Station,
} from '../../types';
import { mapOcpp16StatusToApp, mapOcpp201StatusToApp } from '../../utils/ocppStateMapping';
import { mapTariffToConnectorPricing, type TariffCatalog } from './tariffPricing';
import type { HasuraChargingStationRow } from './types';

const GRADIENTS = [
  'from-emerald-900/80 to-bc-surface',
  'from-sky-900/70 to-bc-surface',
  'from-violet-900/60 to-bc-surface',
  'from-teal-900/60 to-bc-surface',
  'from-amber-900/50 to-bc-surface',
];

/** Hardware-Konfigurationen für bekannte Modelle (basierend auf Arias CITRINE_H2_CONFIG.json) */
const HARDWARE_CONFIGS: Record<string, { model: KnownHardwareModel; features: HardwareFeatures }> = {
  'CityCharge H2': {
    model: 'CityCharge H2',
    features: {
      midCertifiedMeters: true,
      dynamicLoadManagement: true,
      ocppVersion: '1.6',
      multiConnector: true,
    },
  },
  'Elinta CityCharge H2': {
    model: 'CityCharge H2',
    features: {
      midCertifiedMeters: true,
      dynamicLoadManagement: true,
      ocppVersion: '1.6',
      multiConnector: true,
    },
  },
};

/** Erkennt Hardware-Modell und Features basierend auf chargePointModel/Vendor */
function detectHardwareFeatures(
  chargePointModel?: string | null,
  chargePointVendor?: string | null
): { hardwareModel: KnownHardwareModel; hardwareFeatures: HardwareFeatures } {
  const modelKey = chargePointModel ?? '';
  const vendorModelKey = `${chargePointVendor ?? ''} ${modelKey}`.trim();
  
  const config = HARDWARE_CONFIGS[modelKey] ?? HARDWARE_CONFIGS[vendorModelKey];
  
  if (config) {
    return { hardwareModel: config.model, hardwareFeatures: config.features };
  }
  
  return {
    hardwareModel: 'generic',
    hardwareFeatures: {
      midCertifiedMeters: false,
      dynamicLoadManagement: false,
      ocppVersion: '2.0.1',
      multiConnector: false,
    },
  };
}

function mapConnectorStatus(
  ocppStatus: string,
  stationOnline: boolean,
  ocppVersion: '1.6' | '2.0.1' = '2.0.1'
): ConnectorStatus {
  if (!stationOnline) return 'offline';
  
  if (ocppVersion === '1.6') {
    return mapOcpp16StatusToApp(ocppStatus);
  }
  return mapOcpp201StatusToApp(ocppStatus);
}

function mapConnectorType(type?: string | null): ConnectorType {
  if (!type) return 'Type2';
  const t = type.toLowerCase();
  if (t.includes('ccs') || t.includes('combo')) return 'CCS';
  if (t.includes('chademo')) return 'CHAdeMO';
  return 'Type2';
}

function connectorId(evseId: number, connectorId: number): string {
  return `evse-${evseId}-conn-${connectorId}`;
}

export function parseConnectorRef(
  connectorAppId: string
): { evseId: number; connectorId: number } | null {
  const m = /^evse-(\d+)-conn-(\d+)$/.exec(connectorAppId);
  if (!m) return null;
  return { evseId: Number(m[1]), connectorId: Number(m[2]) };
}

export function mapHasuraStationToApp(
  row: HasuraChargingStationRow,
  index: number,
  tariffCatalog?: TariffCatalog
): Station | null {
  const coords = row.coordinates?.coordinates;
  if (!coords || coords.length < 2) return null;

  const [lng, lat] = coords;
  const loc = row.location;
  const name =
    loc?.name ??
    `${row.chargePointVendor ?? 'BC Charge'} ${row.chargePointModel ?? row.id}`.trim();

  const { hardwareModel, hardwareFeatures } = detectHardwareFeatures(
    row.chargePointModel,
    row.chargePointVendor
  );

  const connectors: Connector[] = [];
  for (const evse of row.evses ?? []) {
    for (const conn of evse.connectors ?? []) {
      const pricing = mapTariffToConnectorPricing(conn.tariff, tariffCatalog);
      const powerKw = conn.maximumPowerWatts ? Math.round(conn.maximumPowerWatts / 1000) : 22;
      connectors.push({
        id: connectorId(evse.evseId, conn.connectorId),
        type: mapConnectorType(conn.type),
        powerKw: powerKw > 0 ? powerKw : 22,
        status: mapConnectorStatus(conn.status, row.isOnline, hardwareFeatures.ocppVersion),
        evseId: `DE*BCC*${row.id}*${evse.evseId}*${conn.connectorId}`,
        evseNumber: evse.evseId,
        connectorNumber: conn.connectorId,
        ...pricing,
      });
    }
  }

  if (connectors.length === 0) return null;

  return {
    id: row.id,
    evseCode: row.id.toUpperCase(),
    name,
    address: loc?.address ?? '—',
    city: loc?.city ?? '—',
    zip: loc?.postalCode ?? '—',
    lat,
    lng,
    amenities: row.isOnline ? [] : ['Derzeit offline'],
    openingHours: '24/7',
    operator: 'BC Charge',
    network: 'BC Charge',
    rating: row.isOnline ? 4.8 : 4.0,
    reviewCount: 0,
    imageGradient: GRADIENTS[index % GRADIENTS.length],
    greenEnergy: true,
    accessible: true,
    connectors,
    chargePointVendor: row.chargePointVendor ?? undefined,
    chargePointModel: row.chargePointModel ?? undefined,
    hardwareModel,
    hardwareFeatures,
  };
}

export function mapHasuraStations(rows: HasuraChargingStationRow[], tariffCatalog?: TariffCatalog): Station[] {
  return rows
    .map((r, i) => mapHasuraStationToApp(r, i, tariffCatalog))
    .filter((s): s is Station => s !== null);
}
