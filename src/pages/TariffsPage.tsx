import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  activateTariffVersion,
  fetchPricingTariffs,
  fetchTariffAudit,
  fetchTariffVersions,
  previewPricing,
  rollbackTariffVersion,
  type TariffVersionDto,
} from '../api/backend/pricing';
import { getStations } from '../data/stations';
import { isBackendMode } from '../services/backendMode';
import { useAppStore } from '../store/appStore';
import { connectorHasKnownPrice, formatConnectorPriceSummary } from '../utils/pricing';

const exampleEvents = [
  { at: new Date(Date.now() - 45 * 60_000).toISOString(), type: 'session_start' },
  { at: new Date().toISOString(), type: 'meter_value', energyWh: 8500, midCertified: true },
];

export function TariffsPage() {
  const setToast = useAppStore((s) => s.setToast);
  const backend = isBackendMode();
  const priceRows = getStations().flatMap((s) =>
    s.connectors
      .filter(connectorHasKnownPrice)
      .map((c) => ({ station: s.name, summary: formatConnectorPriceSummary(c) }))
  );
  const uniqueSummaries = [...new Set(priceRows.map((r) => r.summary))];

  const [tariffs, setTariffs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTariff, setSelectedTariff] = useState('');
  const [versions, setVersions] = useState<TariffVersionDto[]>([]);
  const [audit, setAudit] = useState<Array<{ action: string; created_at: string }>>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!backend) return;
    void fetchPricingTariffs()
      .then((r) => setTariffs(r.tariffs.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, [backend]);

  useEffect(() => {
    if (!selectedTariff || !backend) return;
    void fetchTariffVersions(selectedTariff).then((r) => setVersions(r.versions));
    void fetchTariffAudit(selectedTariff).then((r) => setAudit(r.audit));
  }, [selectedTariff, backend]);

  async function handlePreview(version: TariffVersionDto) {
    setLoading(true);
    try {
      const res = await previewPricing({ tariffVersion: version, events: exampleEvents, midCertified: true });
      setPreview(
        `${res.cost.grossEur} € brutto · ${(res.cost.energyWh / 1000).toFixed(2)} kWh · Hash ${res.snapshot.hash.slice(0, 12)}…`
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Vorschau fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(version: TariffVersionDto) {
    try {
      await activateTariffVersion(version.tariffId, version.id);
      setToast(`Version ${version.version} aktiviert`);
      const r = await fetchTariffVersions(version.tariffId);
      setVersions(r.versions);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Aktivierung fehlgeschlagen');
    }
  }

  async function handleRollback(version: TariffVersionDto) {
    try {
      await rollbackTariffVersion(version.tariffId, version.id);
      setToast(`Rollback auf Version ${version.version}`);
      const r = await fetchTariffVersions(version.tariffId);
      setVersions(r.versions);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Rollback fehlgeschlagen');
    }
  }

  return (
    <div className="page-shell">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Tarife & Abrechnung</h1>
      <p className="mt-2 text-bc-muted leading-relaxed">
        Versionierte Tarife mit unveränderlichem Snapshot pro Ladesitzung. Blockiergebühren (Idle) starten
        nur nach OCPP-Ladeende (<code className="text-xs">SuspendedEV</code>,{' '}
        <code className="text-xs">SuspendedEVSE</code>, <code className="text-xs">Idle</code>) – nicht bei
        konstanten Zählerständen. Ladeoptimierung nach Strompreis ist ein separates Feature (Price-Driven
        Charging).
      </p>

      {backend && tariffs.length > 0 && (
        <section className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <h2 className="font-display font-semibold">Tarifversionen</h2>
          <select
            className="mt-3 w-full rounded-xl border border-bc-border bg-bc-surface px-3 py-2 text-sm"
            value={selectedTariff}
            onChange={(e) => setSelectedTariff(e.target.value)}
          >
            <option value="">Tarif wählen…</option>
            {tariffs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {versions.length > 0 && (
            <div className="mt-4 space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="rounded-xl border border-bc-border bg-bc-surface p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      v{v.version} · {v.status} · {v.currency}
                    </p>
                    <p className="font-mono text-xs text-bc-muted">{v.hash.slice(0, 16)}…</p>
                  </div>
                  <p className="mt-1 text-bc-muted">
                    {v.components.map((c) => `${c.kind} ${c.rate}€`).join(' · ')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1.5 text-xs"
                      disabled={loading}
                      onClick={() => void handlePreview(v)}
                    >
                      Vorschau
                    </button>
                    {v.status !== 'active' && (
                      <button
                        type="button"
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => void handleActivate(v)}
                      >
                        Aktivieren
                      </button>
                    )}
                    {v.status === 'archived' && (
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => void handleRollback(v)}
                      >
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {preview && (
            <p className="mt-3 rounded-lg bg-bc-accent/10 px-3 py-2 text-sm text-bc-accent">{preview}</p>
          )}

          {audit.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-bc-muted">Audit</h3>
              <ul className="mt-2 space-y-1 text-xs text-bc-muted">
                {audit.slice(0, 8).map((a, i) => (
                  <li key={i}>
                    {a.created_at} · {a.action}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="mt-6 rounded-2xl border border-bc-accent/30 bg-bc-accent/5 p-4">
        <p className="font-display font-semibold text-bc-accent">BC Points Vorteil</p>
        <p className="mt-1 text-sm text-bc-muted">
          Silber +25 %, Gold +50 %, Platin +100 % auf gesammelte Points pro kWh.
        </p>
      </div>

      <h2 className="mt-8 font-display font-semibold">Aktuelle Anschluss-Preise</h2>
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

      <p className="mt-6 text-xs text-bc-muted">
        Eichrecht: signierte MeterValues werden im TariffSnapshot unverändert gespeichert. Blockiergebühren
        gelten nur bei konfigurierter Idle-Komponente und OCPP-Ladeende (nicht bei konstanten Zählerständen).
        Die App zertifiziert keine Messung selbst.
      </p>
    </div>
  );
}
