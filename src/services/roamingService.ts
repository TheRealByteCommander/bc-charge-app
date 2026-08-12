import { ocpiAdapter } from '../api/ocpi/hubAdapter';
import type { Station } from '../types';

/**
 * Service to merge CitrineOS local stations with OCPI roaming stations.
 */
export async function fetchRoamingStations(): Promise<Station[]> {
  const ocpiLocations = await ocpiAdapter.fetchLocations();
  
  return ocpiLocations.map((loc: any) => ({
    id: loc.id,
    evseCode: `ROAM-${loc.id}`,
    name: loc.name,
    address: loc.address.street,
    city: loc.address.city,
    zip: '10117', // Mock Default
    lat: 52.52,
    lng: 13.40,
    amenities: [],
    openingHours: '24/7',
    operator: 'BC Charge',

    network: 'OCPI',
    rating: 5,
    reviewCount: 0,
    imageGradient: 'from-gray-400 to-gray-600',
    connectors: loc.evses.map((evse: any) => ({
      id: evse.id,
      type: evse.connectorType,
      powerKw: evse.powerKw,
      status: evse.status === 'AVAILABLE' ? 'available' : 'unavailable',
      pricePerKwh: 0.65,
      priceKnown: true,
      livePricing: false,
      tariffId: Number(evse.tariffId) || 0,
      evseId: evse.id,
    })),
    greenEnergy: true,
    accessible: true,
  }));
}

export async function getMergedStations(): Promise<Station[]> {
  // Here we would normally call the backend for local stations and merge with roaming.
  // For now, we provide a bridge to allow the App to handle Roaming data.
  const roaming = await fetchRoamingStations();
  // Return mock set for development
  return roaming;
}
