import type { Connector } from '../types';
import { formatConnectorPriceSummary } from '../utils/pricing';

export function ConnectorPrice({
  connector,
  className = '',
}: {
  connector: Connector;
  className?: string;
}) {
  const unknown = connector.priceKnown === false;

  return (
    <p className={`text-sm text-bc-muted ${className}`}>
      <span className="font-medium text-bc-text">{unknown ? 'Preis: ' : ''}</span>
      {unknown ? 'am Standort' : formatConnectorPriceSummary(connector)}
    </p>
  );
}
