/**
 * Shared OCPP protocol / hardware heuristics for BC Charge frontend.
 * Keep token rules in sync with `server/utils/hardwareProtocol.mjs`.
 */

import type { HardwareFeatures, KnownHardwareModel } from '../types';

export type OcppVersion = HardwareFeatures['ocppVersion'];

export interface HardwareProtocolDetection {
  hardwareModel: KnownHardwareModel;
  ocppVersion: OcppVersion;
  multiConnector: boolean;
  isOcpp16: boolean;
  midCertifiedMeters: boolean;
  dynamicLoadManagement: boolean;
}

/**
 * Detect fleet hardware + OCPP major version from CitrineOS vendor/model strings.
 * Prefer this over ad-hoc includes() scattered across server/UI.
 */
export function detectHardwareProtocol(
  vendor?: string | null,
  model?: string | null
): HardwareProtocolDetection {
  const v = String(vendor ?? '').toLowerCase();
  const m = String(model ?? '').toLowerCase();
  const blob = `${v} ${m}`.trim();

  if (
    v.includes('go-e') ||
    v.includes('goe') ||
    m === 'go-e' ||
    m.includes('go_e') ||
    m.includes('go-e') ||
    blob.includes('goe')
  ) {
    return {
      hardwareModel: 'go-e',
      ocppVersion: '1.6',
      multiConnector: false,
      isOcpp16: true,
      midCertifiedMeters: false,
      dynamicLoadManagement: false,
    };
  }

  if (
    v.includes('elinta') ||
    m.includes('citycharge') ||
    m.includes('city charge') ||
    blob.includes('citycharge h2')
  ) {
    return {
      hardwareModel: 'CityCharge H2',
      ocppVersion: '1.6',
      multiConnector: true,
      isOcpp16: true,
      midCertifiedMeters: true,
      dynamicLoadManagement: true,
    };
  }

  return {
    hardwareModel: 'generic',
    ocppVersion: '2.0.1',
    multiConnector: false,
    isOcpp16: false,
    midCertifiedMeters: false,
    dynamicLoadManagement: false,
  };
}

export function toHardwareFeatures(d: HardwareProtocolDetection): HardwareFeatures {
  return {
    midCertifiedMeters: d.midCertifiedMeters,
    dynamicLoadManagement: d.dynamicLoadManagement,
    ocppVersion: d.ocppVersion,
    multiConnector: d.multiConnector,
  };
}

export function isOcpp16Station(row: {
  chargePointVendor?: string | null;
  chargePointModel?: string | null;
}): boolean {
  return detectHardwareProtocol(row.chargePointVendor, row.chargePointModel).isOcpp16;
}
