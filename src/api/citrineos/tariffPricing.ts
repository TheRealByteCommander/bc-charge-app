import type { Connector, Station } from '../../types';
import type { CitrineosTariff } from './types';

export type TariffCatalog = Map<number, CitrineosTariff>;

/** CitrineOS liefert teils Cent-Beträge als Ganzzahl. */
export function normalizeMoneyAmount(amount: number | undefined | null): number | undefined {
  if (amount == null || Number.isNaN(amount)) return undefined;
  if (amount > 0 && amount < 0.01) return amount;
  if (Number.isInteger(amount) && amount >= 20) return amount / 100;
  return amount;
}

export function buildTariffCatalog(tariffs: CitrineosTariff[]): TariffCatalog {
  const map: TariffCatalog = new Map();
  for (const t of tariffs) {
    if (t.id != null) map.set(Number(t.id), t);
  }
  return map;
}

function pickTariff(
  embedded?: CitrineosTariff | null,
  catalog?: TariffCatalog
): CitrineosTariff | null | undefined {
  if (!embedded && !catalog?.size) return null;
  const id = embedded?.id;
  const fromCatalog = id != null ? catalog?.get(Number(id)) : undefined;
  if (!embedded && !fromCatalog) return null;
  return { ...fromCatalog, ...embedded };
}

export function mapTariffToConnectorPricing(
  tariff: CitrineosTariff | null | undefined,
  catalog?: TariffCatalog
): Pick<
  Connector,
  'pricePerKwh' | 'pricePerMin' | 'sessionFee' | 'currency' | 'tariffId' | 'priceKnown' | 'livePricing'
> {
  const merged = pickTariff(tariff, catalog);
  const pricePerKwh = normalizeMoneyAmount(merged?.pricePerKwh);
  const pricePerMin = normalizeMoneyAmount(merged?.pricePerMin);
  const sessionFee = normalizeMoneyAmount(merged?.pricePerSession);

  if (pricePerKwh == null) {
    return {
      pricePerKwh: 0,
      priceKnown: false,
      livePricing: true,
      currency: merged?.currency ?? 'EUR',
      tariffId: merged?.id != null ? Number(merged.id) : undefined,
    };
  }

  return {
    pricePerKwh,
    pricePerMin,
    sessionFee,
    currency: merged?.currency ?? 'EUR',
    tariffId: merged?.id != null ? Number(merged.id) : undefined,
    priceKnown: true,
    livePricing: true,
  };
}

export function applyTariffCatalogToStations(stations: Station[], catalog: TariffCatalog): Station[] {
  if (!catalog.size) return stations;
  return stations.map((station) => ({
    ...station,
    connectors: station.connectors.map((c) => {
      if (!c.tariffId) return c;
      const fromCatalog = catalog.get(c.tariffId);
      if (!fromCatalog) return c;
      const pricing = mapTariffToConnectorPricing(fromCatalog, catalog);
      return { ...c, ...pricing };
    }),
  }));
}
