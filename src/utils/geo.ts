export type GeoPoint = { type: 'Point'; coordinates: [number, number] };

/** GeoJSON [lng, lat] → App-Koordinaten; erkennt häufige Vertauschung. */
export function parseGeoPoint(point?: GeoPoint | null): { lat: number; lng: number } | null {
  if (!point?.coordinates || point.coordinates.length < 2) return null;
  let [lng, lat] = point.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Häufiger Eingabefehler: lat/lng vertauscht (z. B. DE: lat ~47–55, lng ~5–16)
  if (Math.abs(lat) <= 20 && Math.abs(lng) >= 35) {
    [lat, lng] = [lng, lat];
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function isValidStationPosition(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
