import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDate, formatKwh } from '../utils/format';

function invoiceId(sessionId: string): string {
  const n = sessionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `BC-2026-${String(100000 + (n % 900000)).slice(0, 6)}`;
}

export function HistoryPage() {
  const user = useAppStore((s) => s.user);
  const sessions = useAppStore((s) => s.sessions).filter((s) => s.status === 'completed');

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
      <p className="mt-1 text-bc-muted">{sessions.length} abgeschlossene Sessions</p>
      <div className="mt-6 space-y-3">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-bc-border p-6 text-center text-bc-muted">
            Noch keine abgeschlossenen Ladungen.
          </p>
        ) : (
          sessions.map((sess) => (
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
                {sess.paymentStatus === 'paid' && (
                  <span className="text-bc-accent">Bezahlt</span>
                )}
                {sess.paymentStatus === 'failed' && (
                  <span className="text-bc-danger">Zahlung fehlgeschlagen</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-bc-surface px-3 py-2 text-xs font-mono text-bc-muted">
                <FileText className="h-3.5 w-3.5" />
                Rechnung {invoiceId(sess.id)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
