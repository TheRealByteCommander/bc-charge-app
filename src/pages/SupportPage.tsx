import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LegalFooterLinks } from '../components/LegalPageLayout';
import { companyInfo } from '../data/company';

export function SupportPage() {
  return (
    <div className="page-shell">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Hilfe & Support</h1>
      <p className="mt-2 text-bc-muted">
        Unser Team der Byte Commander GmbH unterstützt Sie bei allen Fragen zu BC Charge.
      </p>

      <div className="mt-8 space-y-4">
        <a
          href={`tel:${companyInfo.phoneTel}`}
          className="flex items-center gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4"
        >
          <Phone className="h-6 w-6 text-bc-accent" />
          <div>
            <p className="font-medium">Hotline</p>
            <p className="text-sm text-bc-muted">{companyInfo.phoneDisplay}</p>
            <p className="text-xs text-bc-muted">{companyInfo.supportHours}</p>
          </div>
        </a>
        <a
          href={`mailto:${companyInfo.emailSupport}`}
          className="flex items-center gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4"
        >
          <Mail className="h-6 w-6 text-bc-accent" />
          <div>
            <p className="font-medium">E-Mail</p>
            <p className="text-sm text-bc-accent">{companyInfo.emailSupport}</p>
          </div>
        </a>
        <div className="flex items-start gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <MapPin className="h-6 w-6 shrink-0 text-bc-accent" />
          <div>
            <p className="font-medium">{companyInfo.legalName}</p>
            <p className="text-sm text-bc-muted">{companyInfo.street}</p>
            <p className="text-sm text-bc-muted">
              {companyInfo.zip} {companyInfo.city}
            </p>
          </div>
        </div>
      </div>

      <h2 className="mt-10 font-display font-semibold">Häufige Fragen</h2>
      <div className="mt-4 space-y-3">
        {[
          {
            q: 'Wie starte ich eine Ladung?',
            a: 'Station in der App öffnen, freien Anschluss wählen und „Laden starten“ tippen – oder QR-Code am Ladepunkt scannen.',
          },
          {
            q: 'Wie sammle ich BC Points?',
            a: 'Automatisch bei jeder abgeschlossenen Ladung. Höhere Mitgliedsstufen bringen Multiplikatoren.',
          },
          {
            q: 'Welche Zahlungsarten werden akzeptiert?',
            a: 'Kredit-/Debitkarte und SEPA-Lastschrift – unter Profil → Zahlung hinterlegen.',
          },
          {
            q: 'Größere Schrift oder einfachere Bedienung?',
            a: 'Unter Profil → Barrierefreiheit (oder /barrierefreiheit): Schriftgröße, hoher Kontrast und einfache Ansicht einstellbar.',
          },
          {
            q: 'Fallen Blockiergebühren an?',
            a: 'Nein. BC Charge erhebt keine Blockier- oder Standgebühren nach dem Laden. Abgerechnet werden nur die geladene Energie (kWh) und ggf. eine Startgebühr – transparent vor dem Ladevorgang.',
          },
          {
            q: 'Rechnung stimmt nicht?',
            a: 'In der Ladehistorie „Rechnung prüfen / Support“ wählen – Ihre Session-Daten werden automatisch an unser Team übermittelt.',
          },
          {
            q: 'Laden lässt sich nicht beenden?',
            a: 'Auf der Ladevorgangs-Seite „Problem beim Beenden?“ nutzen: Hotline mit Session-ID oder Notfall-E-Mail. Wir stoppen den Vorgang remote.',
          },
        ].map((faq) => (
          <details key={faq.q} className="rounded-xl border border-bc-border bg-bc-elevated group">
            <summary className="cursor-pointer px-4 py-3 font-medium">{faq.q}</summary>
            <p className="border-t border-bc-border px-4 py-3 text-sm text-bc-muted">{faq.a}</p>
          </details>
        ))}
      </div>

      <a
        href={companyInfo.website}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary mt-8 block w-full text-center"
      >
        Website bc-charge.com
      </a>

      <LegalFooterLinks className="mt-8 border-t border-bc-border pt-6" />
    </div>
  );
}
