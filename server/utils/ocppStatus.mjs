/** OCPP-1.6/2.0.1 Connector-Status → App-Status (spiegelt src/utils/ocppStateMapping.ts). */

export function mapUnifiedOcppConnectorStatus(status) {
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

export function mapConnectorStatus(ocppStatus, stationOnline) {
  const mapped = mapUnifiedOcppConnectorStatus(ocppStatus);
  if (!stationOnline && (mapped === 'occupied' || mapped === 'reserved')) {
    return mapped;
  }
  if (!stationOnline) return 'offline';
  return mapped;
}

export function isConnectorStartable(status, rawOcppStatus) {
  if (isConnectorActivelyCharging(rawOcppStatus)) return false;
  return status === 'available' || status === 'occupied';
}

export function isConnectorActivelyCharging(rawStatus) {
  const normalized = String(rawStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, '');
  return normalized === 'charging';
}

export function isConnectorFinishing(rawStatus) {
  const normalized = String(rawStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, '');
  return normalized === 'finishing';
}
