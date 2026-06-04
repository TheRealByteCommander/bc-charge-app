import type { Connector, ConnectorStatus, ConnectorType, Station } from '../../types';
import { mapTariffToConnectorPricing, type TariffCatalog } from './tariffPricing';
import type { HasuraChargingStationRow } from './types';

const GRADIENTS = [
  'from-emerald-900/80 to-bc-surface',
  'from-sky-900/70 to-bc-surface',
  'from-violet-900/60 to-bc-surface',
  'from-teal-900/60 to-bc-surface',
  'from-amber-900/50 to-bc-surface',
];

function mapConnectorStatus(ocppStatus: string, stationOnline: boolean): ConnectorStatus {
  if (!stationOnline) return 'offline';
  const s = ocppStatus.toLowerCase();
  if (s.includes('available')) return 'available';
  if (s.includes('occupied') || s.includes('charging')) return 'occupied';
  if (s.includes('reserved')) return 'reserved';
  if (s.includes('unavailable') || s.includes('fault')) return 'offline';
  return 'offline';
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

  const connectors: Connector[] = [];
  for (const evse of row.evses ?? []) {
    for (const conn of evse.connectors ?? []) {
      const pricing = mapTariffToConnectorPricing(conn.tariff, tariffCatalog);
      const powerKw = conn.maximumPowerWatts ? Math.round(conn.maximumPowerWatts / 1000) : 22;
      connectors.push({
        id: connectorId(evse.evseId, conn.connectorId),
        type: mapConnectorType(conn.type),
        powerKw: powerKw > 0 ? powerKw : 22,
        status: mapConnectorStatus(conn.status, row.isOnline),
        evseId: `DE*BCC*${row.id}*${evse.evseId}*${conn.connectorId}`,
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
  };
}

export function mapHasuraStations(rows: HasuraChargingStationRow[], tariffCatalog?: TariffCatalog): Station[] {
  return rows
    .map((r, i) => mapHasuraStationToApp(r, i, tariffCatalog))
    .filter((s): s is Station => s !== null);
}
