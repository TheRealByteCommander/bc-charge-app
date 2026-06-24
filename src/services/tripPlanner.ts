import { getStations } from '../data/stations';
import { haversineKm } from '../utils/geo';
import type { Station, Vehicle } from '../types';
import { pickNearestAvailableStations } from './chargingSuggestion';

export type RoutePreference = 'balanced' | 'fast' | 'cheap' | 'green';

export interface TripPlanInput {
  from: { lat: number; lng: number };
  toLabel: string;
  to: { lat: number; lng: number };
  vehicle: Vehicle;
  startSocPercent: number;
  arrivalSocPercent: number;
  preference: RoutePreference;
}

export interface TripLeg {
  kind: 'drive' | 'charge';
  label: string;
  distanceKm: number;
  station?: Station;
  estMinutes?: number;
  estKwh?: number;
  lat?: number;
  lng?: number;
}

export interface TripPlanResult {
  totalDistanceKm: number;
  legs: TripLeg[];
  estTotalCostEur: number;
  estCo2SavedKg: number;
  routeLine: [number, number][];
  chargeStationIds: string[];
}

/** Grobe Zielkoordinaten für Demo-Städte (später Geocoding-API). */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  berlin: { lat: 52.52, lng: 13.405 },
  münchen: { lat: 48.137, lng: 11.576 },
  muenchen: { lat: 48.137, lng: 11.576 },
  hamburg: { lat: 53.551, lng: 9.994 },
  leipzig: { lat: 51.34, lng: 12.37 },
  dresden: { lat: 51.05, lng: 13.737 },
  frankfurt: { lat: 50.11, lng: 8.682 },
  köln: { lat: 50.938, lng: 6.96 },
  koeln: { lat: 50.938, lng: 6.96 },
};

export function geocodeDestination(label: string): { lat: number; lng: number } | null {
  const key = label.trim().toLowerCase().replace(/\s+/g, '');
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(name)) return coords;
  }
  const stations = getStations();
  const match = stations.find(
    (s) =>
      s.city.toLowerCase().includes(label.toLowerCase()) ||
      s.name.toLowerCase().includes(label.toLowerCase())
  );
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function consumptionKwhPer100km(vehicle: Vehicle, preference: RoutePreference): number {
  const base = (vehicle.batteryKwh / 4.5) * 10;
  if (preference === 'fast') return base * 1.08;
  if (preference === 'cheap' || preference === 'green') return base * 0.95;
  return base;
}

function interpolatePoint(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  fraction: number
): { lat: number; lng: number } {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

function pickStopStation(
  point: { lat: number; lng: number },
  vehicle: Vehicle,
  preference: RoutePreference
) {
  const limit = preference === 'fast' ? 3 : preference === 'green' ? 5 : 4;
  const suggestions = pickNearestAvailableStations({ vehicle, userLocation: point }, limit);
  if (preference === 'green') {
    const green = suggestions.find((s) => s.station.greenEnergy);
    if (green) return green;
  }
  if (preference === 'cheap') {
    return [...suggestions].sort((a, b) => a.connector.pricePerKwh - b.connector.pricePerKwh)[0];
  }
  if (preference === 'fast') {
    return [...suggestions].sort((a, b) => b.connector.powerKw - a.connector.powerKw)[0];
  }
  return suggestions[0];
}

export function planTrip(input: TripPlanInput): TripPlanResult | null {
  const dist = haversineKm(input.from.lat, input.from.lng, input.to.lat, input.to.lng);
  if (dist < 5) return null;

  const consumption = consumptionKwhPer100km(input.vehicle, input.preference);
  const battery = input.vehicle.batteryKwh;
  const usableStart = (input.startSocPercent / 100) * battery;
  const reserve = (input.arrivalSocPercent / 100) * battery;
  const rangeKm = ((usableStart - reserve) / consumption) * 100;

  const legs: TripLeg[] = [];
  const routeLine: [number, number][] = [[input.from.lat, input.from.lng]];
  const chargeStationIds: string[] = [];
  let estCost = 0;

  if (rangeKm >= dist) {
    legs.push({
      kind: 'drive',
      label: input.toLabel,
      distanceKm: Math.round(dist * 10) / 10,
      lat: input.to.lat,
      lng: input.to.lng,
    });
    routeLine.push([input.to.lat, input.to.lng]);
  } else {
    const numStops = Math.min(3, Math.max(1, Math.ceil(dist / rangeKm) - 1));
    const segmentKm = dist / (numStops + 1);
    let from = input.from;

    for (let i = 1; i <= numStops; i++) {
      const fraction = i / (numStops + 1);
      const waypoint = interpolatePoint(input.from, input.to, fraction);
      const suggestion = pickStopStation(waypoint, input.vehicle, input.preference);

      legs.push({
        kind: 'drive',
        label: i === 1 ? 'Erste Etappe' : `Etappe ${i}`,
        distanceKm: Math.round(segmentKm * 10) / 10,
        lat: waypoint.lat,
        lng: waypoint.lng,
      });

      if (suggestion) {
        const kwh = battery * 0.45;
        const price = suggestion.connector.pricePerKwh || 0.49;
        estCost += kwh * price + (suggestion.connector.sessionFee ?? 0);
        chargeStationIds.push(suggestion.station.id);
        routeLine.push([suggestion.station.lat, suggestion.station.lng]);

        legs.push({
          kind: 'charge',
          label: suggestion.station.name,
          distanceKm: suggestion.distanceKm ?? 0,
          station: suggestion.station,
          estMinutes: Math.round(
            (kwh / Math.min(suggestion.connector.powerKw, input.vehicle.maxDcKw)) * 60 + 5
          ),
          estKwh: Math.round(kwh * 10) / 10,
          lat: suggestion.station.lat,
          lng: suggestion.station.lng,
        });
        from = { lat: suggestion.station.lat, lng: suggestion.station.lng };
      } else {
        routeLine.push([waypoint.lat, waypoint.lng]);
        from = waypoint;
      }
    }

    const lastSegment = haversineKm(from.lat, from.lng, input.to.lat, input.to.lng);
    legs.push({
      kind: 'drive',
      label: input.toLabel,
      distanceKm: Math.round(lastSegment * 10) / 10,
      lat: input.to.lat,
      lng: input.to.lng,
    });
    routeLine.push([input.to.lat, input.to.lng]);
  }

  const driveKwh = (dist / 100) * consumption;
  const co2 = driveKwh * 0.35;

  return {
    totalDistanceKm: Math.round(dist * 10) / 10,
    legs,
    estTotalCostEur: Math.round(estCost * 100) / 100,
    estCo2SavedKg: Math.round(co2 * 10) / 10,
    routeLine,
    chargeStationIds,
  };
}

export function mapsDirectionsUrl(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

export function mapsDirectionsWithWaypoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[]
): string {
  const wp = waypoints.map((p) => `${p.lat},${p.lng}`).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
  return wp ? `${base}&waypoints=${encodeURIComponent(wp)}` : base;
}
