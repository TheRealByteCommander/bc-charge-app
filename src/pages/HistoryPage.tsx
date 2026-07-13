import { useState } from 'react';
import { AlertTriangle, Download, FileText, LifeBuoy, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadInvoicePdf } from '../api/backend/invoices';
import { useAppStore } from '../store/appStore';
import { isBackendMode } from '../services/backendMode';
import type { ChargingSession } from '../types';
import { formatCurrency, formatDate, formatKwh } from '../utils/format';
import { displayInvoiceNumber } from '../utils/invoice';
import { buildSessionSupportMailto } from '../utils/supportContact';

const MID_CERTIFIED_MODELS = ['CityCharge H2', 'Elinta CityCharge H2'];

function isMidCertifiedSession(session: ChargingSession): boolean {
  if (session.midCertified) return true;
  if (session.chargePointModel && MID_CERTIFIED_MODELS.includes(session.chargePointModel)) return true;
  return false;
}

function SessionDisputeActions({ session }: { session: ChargingSession }) {
  return (
    <a
      href={buildSessionSupportMailto(session, 'dispute')}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-bc-border bg-bc-surface px-3 py-2.5 text-sm text-bc-muted transition hover:border-bc-accent/40 hover:text-bc-accent"
    >
      <LifeBuoy className="h-4 w-4" />
      Rechnung prüfen / Support
    </a>
  );
}

export function HistoryPage() {
  const user = useAppStore((s) => s.user);
  const setToast = useAppStore((s) => s.setToast);
  const activeSession = useAppStore((s) => s.activeSession);
  const abandonStuckSession = useAppStore((s) => s.abandonStuckSession);
  const sessions = useAppStore((s) => s.sessions).filter((s) => s.status === 'completed');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const backend = isBackendMode();

  async function handleAbandon() {
    if (
      !window.confirm(
        'Laufenden Vorgang wirklich abbrechen? Die Sitzung wird beendet, damit Sie neu laden können.'
      )
    ) {
      return;
    }
    setAbandoning(true);
    const result = await abandonStuckSession();
    setAbandoning(false);
    if (!result.ok) {
      setToast(result.error ?? 'Abbrechen fehlgeschlagen.');
    }
  }

  async function handleDownload(sessionId: string, invoiceNumber: string) {
    if (!backend) {
      setToast('PDF-Rechnungen sind nur mit aktivem Backend verfügbar.');
      return;
    }
    setDownloadingId(sessionId);
    try {
      await downloadInvoicePdf(sessionId, invoiceNumber);
      setToast('Rechnung wurde heruntergeladen.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Download fehlgeschlagen.');
    } finally {
      setDownloadingId(null);
    }
  }

  if (!user) {
    return (
      <div className="page-shell text-center">
        <p className="text-bc-muted">Anmeldung erforderlich.</p>
        <Link to="/anmelden" className="btn-primary mt-6 inline-block">
          Anmelden
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">Ladehistorie</h1>
      <p className="mt-1 text-bc-muted">
        {sessions.length} abgeschlossene Sessions · Rechnung prüfen oder Support kontaktieren
      </p>

      {activeSession && (
        <div
          className="mt-6 rounded-2xl border border-bc-warn/40 bg-bc-warn/10 p-4 text-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bc-warn" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Noch ein aktiver Ladevorgang</p>
              <p className="mt-1 text-bc-muted">
                {activeSession.stationName} · {formatKwh(activeSession.energyKwh)} · seit{' '}
                {formatDate(activeSession.startedAt)}
              </p>
              <p className="mt-2 text-bc-muted">
                Solange dieser Vorgang offen ist, starten keine neuen Ladungen und Status-Updates können
                ausbleiben.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link to="/laden" className="btn-primary flex-1 py-2.5 text-center text-sm">
                  Zur laufenden Sitzung
                </Link>
                {backend && (
                  <button
                    type="button"
                    className="btn-secondary flex-1 py-2.5 text-sm text-bc-danger border-bc-danger/30"
                    onClick={() => void handleAbandon()}
                    disabled={abandoning}
                  >
                    {abandoning ? 'Wird beendet …' : 'Vorgang abbrechen'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-bc-border p-6 text-center text-bc-muted">
            Noch keine abgeschlossenen Ladungen.
          </p>
        ) : (
          sessions.map((sess) => {
            const invoiceNo = displayInvoiceNumber(sess);
            const isDownloading = downloadingId === sess.id;
            return (
              <div key={sess.id} className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{sess.stationName}</p>
                    <p className="text-sm text-bc-muted">{sess.endedAt && formatDate(sess.endedAt)}</p>
                  </div>
                  <p className="font-display font-bold">{formatCurrency(sess.costEur)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-bc-muted">
                  <span>{formatKwh(sess.energyKwh)}</span>
                  <span>{sess.connectorType}</span>
                  <span className="text-bc-accent">+{sess.pointsEarned} Points</span>
                  {sess.paymentStatus === 'paid' && <span className="text-bc-accent">Bezahlt</span>}
                  {sess.paymentStatus === 'failed' && (
                    <span className="text-bc-danger">Zahlung fehlgeschlagen</span>
                  )}
                  {sess.invoiceEmailedAt && <span>E-Rechnung versendet</span>}
                  {isMidCertifiedSession(sess) && (
                    <span className="flex items-center gap-1 text-bc-blue" title="MID-zertifizierte Messung nach deutschem Eichrecht">
                      <Scale className="h-3 w-3" /> Eichrecht
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload(sess.id, invoiceNo)}
                  disabled={!backend || isDownloading}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg bg-bc-surface px-3 py-2 text-left text-xs font-mono text-bc-muted transition hover:bg-bc-border disabled:cursor-not-allowed disabled:opacity-60"
                  title={backend ? 'Rechnung als PDF herunterladen' : 'Backend erforderlich für PDF-Rechnungen'}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Rechnung {invoiceNo}
                  </span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-bc-accent" />
                </button>
                <SessionDisputeActions session={sess} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
