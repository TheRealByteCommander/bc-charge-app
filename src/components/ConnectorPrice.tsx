import { useAppStore } from '../store/appStore';
import type { Connector } from '../types';
import { formatConnectorPriceSummary } from '../utils/pricing';

export function ConnectorPrice({
  connector,
  showLiveBadge = true,
  className = '',
}: {
  connector: Connector;
  showLiveBadge?: boolean;
  className?: string;
}) {
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const pricingSyncedAt = useAppStore((s) => s.pricingSyncedAt);
  const isLive =
    stationDataSource === 'citrineos' && connector.livePricing !== false && connector.priceKnown !== false;

  return (
    <div className={className}>
      <p className="text-sm text-bc-muted">
        <span className="font-medium text-bc-text">Aktueller Preis: </span>
        {formatConnectorPriceSummary(connector)}
      </p>
      {showLiveBadge && isLive && (
        <p className="mt-0.5 text-xs text-bc-accent">
          Tarif aus CitrineOS
          {pricingSyncedAt
            ? ` · Stand ${new Date(pricingSyncedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`
            : ''}
        </p>
      )}
      {stationDataSource === 'citrineos' && connector.priceKnown === false && (
        <p className="mt-0.5 text-xs text-bc-warn">Kein Tarif am Anschluss in CitrineOS hinterlegt.</p>
      )}
    </div>
  );
}
