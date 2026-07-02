import type { Connector, Vehicle } from '../types';
import { connectorHasKnownPrice } from './pricing';

const CHARGE_EFFICIENCY = 0.85;
const DEFAULT_START_SOC = 30;
const DEFAULT_TARGET_SOC = 80;

export interface ChargeEstimate {
  kwh: number;
  totalEur: number;
  estMinutes: number;
  effectivePowerKw: number;
  priceKnown: boolean;
  startSocPercent: number;
  targetSocPercent: number;
}

function effectiveChargePowerKw(connector: Connector, vehicle?: Vehicle): number {
  const isDc = connector.type === 'CCS' || connector.type === 'CHAdeMO';
  const vehicleMax = vehicle ? (isDc ? vehicle.maxDcKw : vehicle.maxAcKw) : connector.powerKw;
  return Math.min(connector.powerKw, vehicleMax);
}

export function estimateChargeSession(
  connector: Connector,
  vehicle?: Vehicle,
  options?: { startSocPercent?: number; targetSocPercent?: number }
): ChargeEstimate {
  const startSoc = options?.startSocPercent ?? DEFAULT_START_SOC;
  const targetSoc = options?.targetSocPercent ?? DEFAULT_TARGET_SOC;
  const battery = vehicle?.batteryKwh ?? 60;
  const kwh = Math.max(0, ((targetSoc - startSoc) / 100) * battery);
  const effectivePowerKw = effectiveChargePowerKw(connector, vehicle);
  const estMinutes =
    effectivePowerKw > 0 ? Math.ceil((kwh / (effectivePowerKw * CHARGE_EFFICIENCY)) * 60) : 0;

  let totalEur = 0;
  if (connectorHasKnownPrice(connector)) {
    totalEur = kwh * connector.pricePerKwh;
    if (connector.pricePerMin) totalEur += estMinutes * connector.pricePerMin;
  }

  return {
    kwh: Math.round(kwh * 10) / 10,
    totalEur: Math.round(totalEur * 100) / 100,
    estMinutes,
    effectivePowerKw,
    priceKnown: connectorHasKnownPrice(connector),
    startSocPercent: startSoc,
    targetSocPercent: targetSoc,
  };
}

export function estimateRemainingChargeMinutes(
  energyKwh: number,
  targetKwh: number,
  powerKw: number
): number | null {
  const remaining = targetKwh - energyKwh;
  if (remaining <= 0) return 0;
  if (powerKw <= 0) return null;
  return Math.ceil((remaining / (powerKw * CHARGE_EFFICIENCY)) * 60);
}

export function vehicleTargetKwh(vehicle: Vehicle, targetSocPercent = DEFAULT_TARGET_SOC): number {
  return (targetSocPercent / 100) * vehicle.batteryKwh;
}
