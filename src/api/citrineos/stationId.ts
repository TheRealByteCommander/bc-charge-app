import { getStationById } from '../../data/stations';

/** Hasura Transactions.stationId ist Int (ChargingStations.id), nicht ocppConnectionName. */
export function resolveCitrineosStationDbId(stationAppId: string): number {
  const station = getStationById(stationAppId);
  if (station?.citrineosDatabaseId != null && station.citrineosDatabaseId > 0) {
    return station.citrineosDatabaseId;
  }
  const parsed = Number(stationAppId);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  throw new Error(`Keine CitrineOS-Datenbank-ID für Station „${stationAppId}“`);
}
