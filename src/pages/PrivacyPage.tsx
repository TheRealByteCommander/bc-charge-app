import { Link } from 'react-router-dom';
import { companyInfo, dataProtectionAuthority } from '../data/company';
import { LegalPageLayout, LegalSection } from '../components/LegalPageLayout';
import { LOCAL_STORAGE_DISCLOSURE } from '../utils/privacy';

export function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Datenschutzerklärung"
      subtitle={`${companyInfo.brand} · Stand Juli 2026 · Art. 13/14 DSGVO · § 25 TDDDG`}
    >
      <LegalSection title="1. Verantwortlicher">
        <p>
          {companyInfo.legalName}
          <br />
          {companyInfo.street}, {companyInfo.zip} {companyInfo.city}
          <br />
          E-Mail:{' '}
          <a href={`mailto:${companyInfo.emailPrivacy}`} className="text-bc-accent">
            {companyInfo.emailPrivacy}
          </a>
          <br />
          Telefon:{' '}
          <a href={`tel:${companyInfo.phoneTel}`} className="text-bc-accent">
            {companyInfo.phoneDisplay}
          </a>
          <br />
          <Link to="/impressum" className="text-bc-accent">
            Impressum
          </Link>
        </p>
      </LegalSection>

      <LegalSection title="2. Zwecke & Datenkategorien">
        <ul className="list-disc space-y-1 pl-5">
          <li>Konto: Name, E-Mail, Telefon, Mitglieds-ID, Fahrzeuge, Favoriten</li>
          <li>Laden: Sessions, kWh, Kosten, Zahlungsreferenzen</li>
          <li>Standort (optional): GPS-Koordinaten nur nach Einwilligung, für Entfernungen</li>
          <li>Kamera (optional): nur nach Einwilligung für QR-Scan und Community-Fotos</li>
          <li>Technisch: App-Einstellungen, Offline-Karten-Cache, Community-Meldungen</li>
          <li>Marketing (optional): Werbe-Benachrichtigungen nur mit Einwilligung</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Rechtsgrundlagen">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> – Vertrag: Konto, Laden, Abrechnung
          </li>
          <li>
            <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> in Verbindung mit{' '}
            <strong>§ 25 Abs. 1 TDDDG</strong> – Einwilligung: Standort, Kamera, Marketing
          </li>
          <li>
            <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> – Berechtigtes Interesse: IT-Sicherheit,
            Betrugsprävention, technischer Betrieb
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Speicherung auf Ihrem Gerät">
        <p>
          Zusätzlich zu den serverseitig verarbeiteten Kontodaten speichert die App technische und
          Einstellungsdaten lokal auf Ihrem Endgerät (Browser-Speicher, Service Worker). Für den
          Zugriff auf Standort und Kamera holen wir vorab Ihre Einwilligung nach § 25 Abs. 1 TDDDG
          ein. Übersicht der lokalen Speicher:
        </p>
        <div className="mt-2 overflow-hidden rounded-xl border border-bc-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-bc-surface text-bc-text">
              <tr>
                <th className="px-3 py-2 font-medium">Speicher</th>
                <th className="px-3 py-2 font-medium">Zweck</th>
              </tr>
            </thead>
            <tbody>
              {LOCAL_STORAGE_DISCLOSURE.map((row) => (
                <tr key={row.key} className="border-t border-bc-border">
                  <td className="px-3 py-2 font-mono text-[10px]">{row.key}</td>
                  <td className="px-3 py-2">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="5. Speicherdauer">
        <ul className="list-disc space-y-1 pl-5">
          <li>Kontodaten: bis zur Löschung des Kontos (Profil oder Anfrage an uns)</li>
          <li>Ladehistorie: steuer- und handelsrechtlich ggf. bis zu 10 Jahre (Produktion)</li>
          <li>Standort-Einwilligung: bis Widerruf in der App (§ 25 TDDDG)</li>
          <li>Marketing-Einwilligung: bis Widerruf unter Benachrichtigungen</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Empfänger & Auftragsverarbeiter">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Stripe Payments Europe Ltd.</strong> – Zahlungsabwicklung.{' '}
            <a
              href="https://stripe.com/de/privacy"
              className="text-bc-accent"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutz bei Stripe
            </a>
            . Kartendaten werden nicht auf unseren Servern gespeichert.
          </li>
          <li>
            <strong>Ladepunkt-Backend (CitrineOS)</strong> – sofern konfiguriert: Status und Tarife
            von Ladestationen (keine direkte Identifikation ohne Ladevorgang).
          </li>
          <li>
            <strong>OpenStreetMap / Leaflet</strong> – Kartenkacheln; beim Laden der Karte wird Ihre
            IP an Karten-Server übermittelt.
          </li>
          <li>
            <strong>Google Fonts</strong> – Schriftarten werden beim Seitenaufruf von Google-Servern
            geladen (IP-Adresse). Sie können dies in den Browser-Einstellungen einschränken.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Ihre Rechte">
        <p>Sie haben nach der DSGVO insbesondere folgende Rechte:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
          <li>Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21)</li>
          <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft</li>
        </ul>
        <p className="mt-2">
          In der App: <strong>Profil → Daten exportieren</strong> (JSON),{' '}
          <strong>Standort widerrufen</strong>, <strong>Konto löschen</strong>. Für Anfragen:{' '}
          <a href={`mailto:${companyInfo.emailPrivacy}`} className="text-bc-accent">
            {companyInfo.emailPrivacy}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Beschwerderecht">
        <p>
          Sie können sich bei einer Aufsichtsbehörde beschweren, z. B. beim{' '}
          {dataProtectionAuthority.name}, {dataProtectionAuthority.street},{' '}
          {dataProtectionAuthority.zip} {dataProtectionAuthority.city},{' '}
          <a href={dataProtectionAuthority.website} className="text-bc-accent" target="_blank" rel="noopener noreferrer">
            {dataProtectionAuthority.website}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Pflicht zur Bereitstellung">
        <p>
          Die Bereitstellung von Kontodaten ist für den Vertrag erforderlich. Standort, Kamera und
          Marketing sind freiwillig. Ohne Standort nutzen Sie Karte und Suche ohne exakte
          Entfernungsanzeige. Ohne Kamera können Sie Ladepunkt-IDs manuell eingeben.
        </p>
      </LegalSection>

      <p className="text-xs text-bc-muted">
        <Link to="/nutzungsbedingungen" className="text-bc-accent">
          Nutzungsbedingungen
        </Link>
      </p>
    </LegalPageLayout>
  );
}
