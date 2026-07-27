import type { Connector } from '../types';
import { formatCurrency } from './format';
import { calculateDynamicPrice } from './dynamicPricing';

export function connectorHasKnownPrice(c: Connector): boolean {
  return c.priceKnown !== false && c.pricePerKwh > 0;
}

export function minKnownPricePerKwh(connectors: Connector[]): number | null {
  const prices = connectors.filter(connectorHasKnownPrice).map((c) => c.pricePerKwh);
  return prices.length ? Math.min(...prices) : null;
}

export function formatConnectorPriceSummary(c: Connector): string {
  if (!connectorHasKnownPrice(c)) return 'Aktueller Tarif nicht verfügbar';
  
  // If livePricing is enabled, we show it's dynamic
  const price = c.livePricing ? calculateDynamicPrice(c.pricePerKwh) : c.pricePerKwh;
  
  const parts = [`${formatCurrency(price)}/kWh`];
  if (c.pricePerMin) parts.push(`${formatCurrency(c.pricePerMin)}/Min`);
  return parts.join(' · ');
}
