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
}

export interface TripPlanResult {
  totalDistanceKm: number;
  legs: TripLeg[];
  estTotalCostEur: number;
  estCo2SavedKg: number;
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

export function planTrip(input: TripPlanInput): TripPlanResult | null {
  const dist = haversineKm(input.from.lat, input.from.lng, input.to.lat, input.to.lng);
  if (dist < 5) return null;

  const consumption = consumptionKwhPer100km(input.vehicle, input.preference);
  const battery = input.vehicle.batteryKwh;
  const usableStart = (input.startSocPercent / 100) * battery;
  const reserve = (input.arrivalSocPercent / 100) * battery;
  const rangeKm = ((usableStart - reserve) / consumption) * 100;

  const legs: TripLeg[] = [
    { kind: 'drive', label: input.toLabel, distanceKm: Math.round(dist * 10) / 10 },
  ];

  let estCost = 0;
  const stops: Station[] = [];

  if (rangeKm < dist) {
    const mid = {
      lat: (input.from.lat + input.to.lat) / 2,
      lng: (input.from.lng + input.to.lng) / 2,
    };
    const suggestions = pickNearestAvailableStations(
      { vehicle: input.vehicle, userLocation: mid },
      input.preference === 'fast' ? 2 : 3
    );
    for (const s of suggestions) {
      stops.push(s.station);
      const kwh = battery * 0.45;
      const price = s.connector.pricePerKwh || 0.49;
      estCost += kwh * price + (s.connector.sessionFee ?? 0);
      legs.splice(legs.length - 1, 0, {
        kind: 'charge',
        label: s.station.name,
        distanceKm: s.distanceKm ?? 0,
        station: s.station,
        estMinutes: Math.round((kwh / Math.min(s.connector.powerKw, input.vehicle.maxDcKw)) * 60 + 5),
        estKwh: Math.round(kwh * 10) / 10,
      });
    }
  }

  const driveKwh = (dist / 100) * consumption;
  const co2 = driveKwh * 0.35;

  return {
    totalDistanceKm: Math.round(dist * 10) / 10,
    legs,
    estTotalCostEur: Math.round(estCost * 100) / 100,
    estCo2SavedKg: Math.round(co2 * 10) / 10,
  };
}

export function mapsDirectionsUrl(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}
