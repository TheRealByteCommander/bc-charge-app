/** Parst QR-/Deep-Link-URLs für Ad-Hoc-Laden. */

export interface ParsedChargeDeepLink {
  stationId: string;
  connectorId?: string;
  adhoc: boolean;
}

const STATION_PATH_RE = /\/station\/([^/?#]+)/i;

export function parseChargeDeepLink(raw: string): ParsedChargeDeepLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(STATION_PATH_RE);
      if (!match?.[1]) return null;
      return {
        stationId: decodeURIComponent(match[1]),
        connectorId: url.searchParams.get('connector') ?? undefined,
        adhoc: url.searchParams.get('adhoc') === '1',
      };
    } catch {
      return null;
    }
  }

  if (STATION_PATH_RE.test(trimmed)) {
    const match = trimmed.match(STATION_PATH_RE);
    if (!match?.[1]) return null;
    const query = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?')) : '';
    const params = new URLSearchParams(query);
    return {
      stationId: decodeURIComponent(match[1]),
      connectorId: params.get('connector') ?? undefined,
      adhoc: params.get('adhoc') === '1',
    };
  }

  return null;
}

export function buildGuestChargePath(stationId: string, connectorId?: string): string {
  const params = new URLSearchParams({ station: stationId });
  if (connectorId) params.set('connector', connectorId);
  return `/laden/gast?${params.toString()}`;
}

export function buildAdhocQrUrl(stationId: string, connectorId: string, origin?: string): string {
  const base = (origin ?? 'https://main.bc-charge.com').replace(/\/$/, '');
  const params = new URLSearchParams({ connector: connectorId, adhoc: '1' });
  return `${base}/station/${encodeURIComponent(stationId)}?${params.toString()}`;
}
