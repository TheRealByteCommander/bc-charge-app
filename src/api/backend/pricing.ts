import { backendApi } from './client';

export interface TariffComponentDto {
  kind: 'energy' | 'time' | 'session' | 'idle' | 'reservation';
  rate: string;
  priority?: number;
  idleGraceSeconds?: number;
}

export interface TariffVersionDto {
  id: string;
  tariffId: string;
  version: number;
  status: string;
  name?: string;
  validFrom: string;
  validTo?: string | null;
  timezone: string;
  currency: string;
  taxRateBp: number;
  components: TariffComponentDto[];
  minPrice?: string | null;
  maxPrice?: string | null;
  hash: string;
}

export interface PricingPreviewResult {
  snapshot: { hash: string; frozenAt: string };
  cost: {
    netEur: string;
    taxEur: string;
    grossEur: string;
    energyWh: number;
    lines: Array<{ code: string; kind: string; label: string; grossEur: string }>;
  };
}

export async function fetchPricingTariffs() {
  return backendApi<{ tariffs: Array<{ id: string; name: string; citrineos_tariff_id?: string }> }>(
    '/api/pricing/tariffs'
  );
}

export async function fetchTariffVersions(tariffId: string) {
  return backendApi<{ versions: TariffVersionDto[] }>(`/api/pricing/tariffs/${tariffId}/versions`);
}

export async function fetchTariffAudit(tariffId: string) {
  return backendApi<{ audit: Array<{ action: string; created_at: string; actor?: string }> }>(
    `/api/pricing/tariffs/${tariffId}/audit`
  );
}

export async function previewPricing(body: {
  tariffVersion: Partial<TariffVersionDto>;
  events: Array<Record<string, unknown>>;
  midCertified?: boolean;
}) {
  return backendApi<PricingPreviewResult>('/api/pricing/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function activateTariffVersion(tariffId: string, versionId: string) {
  return backendApi<{ ok: boolean }>(`/api/pricing/tariffs/${tariffId}/versions/${versionId}/activate`, {
    method: 'POST',
  });
}

export async function rollbackTariffVersion(tariffId: string, versionId: string) {
  return backendApi<{ ok: boolean }>(`/api/pricing/tariffs/${tariffId}/versions/${versionId}/rollback`, {
    method: 'POST',
  });
}

export async function fetchOcpiTariffs() {
  return backendApi<{ tariffs: unknown[]; version: string }>('/api/pricing/ocpi/tariffs');
}
