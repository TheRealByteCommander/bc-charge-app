import type { Connector } from '../types';
import { formatCurrency } from './format';

export function connectorHasKnownPrice(c: Connector): boolean {
  return c.priceKnown !== false && c.pricePerKwh > 0;
}

export function minKnownPricePerKwh(connectors: Connector[]): number | null {
  const prices = connectors.filter(connectorHasKnownPrice).map((c) => c.pricePerKwh);
  return prices.length ? Math.min(...prices) : null;
}

export function formatConnectorPriceSummary(c: Connector): string {
  if (!connectorHasKnownPrice(c)) return 'Aktueller Tarif nicht verfügbar';
  const parts = [`${formatCurrency(c.pricePerKwh)}/kWh`];
  if (c.sessionFee) parts.push(`Start ${formatCurrency(c.sessionFee)}`);
  if (c.pricePerMin) parts.push(`${formatCurrency(c.pricePerMin)}/Min`);
  return parts.join(' · ');
}
