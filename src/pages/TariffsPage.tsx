import { Link } from 'react-router-dom';
import { getStations } from '../data/stations';
import { connectorHasKnownPrice, formatConnectorPriceSummary } from '../utils/pricing';

export function TariffsPage() {
  const priceRows = getStations().flatMap((s) =>
    s.connectors
      .filter(connectorHasKnownPrice)
      .map((c) => ({
        station: s.name,
        summary: formatConnectorPriceSummary(c),
      }))
  );

  const uniqueSummaries = [...new Set(priceRows.map((r) => r.summary))];

  return (
    <div className="page-shell">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Tarife & Preise</h1>
      <p className="mt-2 text-bc-muted leading-relaxed">
        Übersicht der Energiepreise im BC-Charge-Netz – pro Anschluss und Standort.
      </p>

      <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-accent/5 p-4">
        <p className="font-display font-semibold text-bc-accent">BC Points Vorteil</p>
        <p className="mt-1 text-sm text-bc-muted">
          Silber +25 %, Gold +50 %, Platin +100 % auf gesammelte Points pro kWh.
        </p>
      </div>

      <h2 className="mt-8 font-display font-semibold">Energiepreise</h2>
      {uniqueSummaries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {uniqueSummaries.map((summary) => (
            <span
              key={summary}
              className="rounded-xl border border-bc-border bg-bc-elevated px-4 py-2 text-sm font-medium"
            >
              {summary}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-bc-muted">Aktuell sind keine Preisangaben verfügbar.</p>
      )}

      <h2 className="mt-8 font-display font-semibold">Standortübersicht</h2>
      <div className="mt-3 space-y-2">
        {priceRows.length > 0 ? (
          priceRows.slice(0, 20).map((r, i) => (
            <div key={i} className="rounded-xl border border-bc-border bg-bc-elevated px-3 py-2 text-sm">
              <p className="truncate font-medium">{r.station}</p>
              <p className="text-bc-muted">{r.summary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-bc-muted">Keine Preisdaten verfügbar.</p>
        )}
      </div>
    </div>
  );
}
