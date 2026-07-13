import { Copy, Mail, Phone, Star } from 'lucide-react';
import { useState } from 'react';
import { companyInfo } from '../data/company';
import type { ChargingSession } from '../types';
import { useAppStore } from '../store/appStore';
import {
  buildSessionSupportMailto,
  buildSupportPhoneUri,
  copySessionSupportText,
} from '../utils/supportContact';

export function ChargingEmergencyHelp({ session }: { session: ChargingSession }) {
  const [copied, setCopied] = useState(false);
  const user = useAppStore((s) => s.user);
  const priorityActive =
    Boolean(user?.prioritySupportUntil) && new Date(user!.prioritySupportUntil!) > new Date();

  const handleCopy = async () => {
    try {
      await copySessionSupportText(session, 'emergency');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-bc-warn/30 bg-bc-warn/5 p-4">
      <p className="font-display font-semibold text-bc-text">Problem beim Beenden?</p>
      <p className="mt-1 text-sm text-bc-muted">
        Wenn „Laden beenden“ nicht reagiert oder das Kabel blockiert bleibt, kontaktieren Sie uns mit Ihrer
        Session-ID – wir stoppen den Vorgang remote.
      </p>
      {priorityActive && (
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-bc-accent">
          <Star className="h-4 w-4" />
          Priority Support aktiv
        </p>
      )}
      <p className="mt-2 font-mono text-xs text-bc-muted">Session: {session.id}</p>

      <div className="mt-4 grid gap-2">
        <a
          href={buildSupportPhoneUri()}
          className="btn-primary flex items-center justify-center gap-2 bg-bc-warn from-bc-warn to-amber-600 py-3 text-sm"
        >
          <Phone className="h-4 w-4" />
          Hotline {companyInfo.phoneDisplay}
        </a>
        <a
          href={buildSessionSupportMailto(session, 'emergency')}
          className="btn-secondary flex items-center justify-center gap-2 py-3 text-sm"
        >
          <Mail className="h-4 w-4" />
          Notfall per E-Mail
        </a>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center justify-center gap-2 rounded-xl border border-bc-border bg-bc-elevated py-3 text-sm text-bc-muted"
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Kopiert!' : 'Session-Daten kopieren'}
        </button>
      </div>
      <p className="mt-3 text-xs text-bc-muted">{companyInfo.supportHours}</p>
    </div>
  );
}
