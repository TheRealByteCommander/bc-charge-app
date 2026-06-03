import { Link } from 'react-router-dom';
import { companyInfo } from '../data/company';

export function PrivacyPage() {
  return (
    <div className="page-shell prose prose-invert max-w-none">
      <h1 className="font-display text-2xl font-bold text-bc-text">Datenschutz</h1>
      <p className="mt-2 text-sm text-bc-muted">Stand: Juni 2026 · BC Charge (Demo-/Entwicklungsstand)</p>

      <section className="mt-6 space-y-3 text-sm text-bc-muted leading-relaxed">
        <h2 className="font-display text-lg font-semibold text-bc-text">Verantwortlicher</h2>
        <p>
          {companyInfo.legalName} · {companyInfo.street} · {companyInfo.zip} {companyInfo.city}
          <br />
          Telefon:{' '}
          <a href={`tel:${companyInfo.phoneTel}`} className="text-bc-accent">
            {companyInfo.phoneDisplay}
          </a>
          <br />
          E-Mail:{' '}
          <a href={`mailto:${companyInfo.emailLegal}`} className="text-bc-accent">
            {companyInfo.emailLegal}
          </a>
        </p>

        <h2 className="font-display text-lg font-semibold text-bc-text">Welche Daten verarbeitet werden</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Profil (Name, E-Mail, Telefon, Mitglieds-ID)</li>
          <li>Ladehistorie, Fahrzeuge, Favoriten, BC Points (aktuell im Browser/localStorage)</li>
          <li>Standort (optional, nur nach Einwilligung, für Entfernungsanzeige)</li>
          <li>Zahlungsdaten über Stripe (Karten-/SEPA-Token, keine vollständigen Kartendaten auf unseren Servern)</li>
        </ul>

        <h2 className="font-display text-lg font-semibold text-bc-text">Rechtsgrundlagen (DSGVO)</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vertrag / vorvertragliche Maßnahmen (Art. 6 Abs. 1 lit. b) – Nutzung der Lade-App</li>
          <li>Einwilligung (Art. 6 Abs. 1 lit. a) – Standort, Marketing-Benachrichtigungen</li>
          <li>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f) – Betrugsprävention, IT-Sicherheit</li>
        </ul>

        <h2 className="font-display text-lg font-semibold text-bc-text">Auftragsverarbeiter</h2>
        <p>
          <strong>Stripe Payments Europe Ltd.</strong> – Zahlungsabwicklung (PCI-DSS). Es gelten die{' '}
          <a
            href="https://stripe.com/de/privacy"
            className="text-bc-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe-Datenschutzhinweise
          </a>
          .
        </p>

        <h2 className="font-display text-lg font-semibold text-bc-text">Speicherdauer &amp; Ihre Rechte</h2>
        <p>
          Sie können unter <strong>Profil → Lokale Daten löschen</strong> alle auf diesem Gerät gespeicherten
          Kontodaten entfernen. Weitere Rechte: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch,
          Datenübertragbarkeit, Beschwerde bei einer Aufsichtsbehörde (Art. 15–21 DSGVO).
        </p>

        <h2 className="font-display text-lg font-semibold text-bc-text">Sicherheitshinweis (Demo)</h2>
        <p>
          Diese Version speichert Konten im Browser und ist nicht für den Produktivbetrieb ohne serverseitige
          Authentifizierung geeignet. Details: <code className="text-bc-text">SECURITY.md</code> im Projekt.
        </p>
      </section>

      <Link to="/profil" className="btn-secondary mt-8 inline-block">
        Zurück zum Profil
      </Link>
    </div>
  );
}
