import { Link } from 'react-router-dom';
import { companyInfo } from '../data/company';
import { LegalPageLayout, LegalSection } from '../components/LegalPageLayout';

export function TermsPage() {
  return (
    <LegalPageLayout
      title="Nutzungsbedingungen"
      subtitle={`${companyInfo.brand} · Stand Juni 2026`}
    >
      <LegalSection title="1. Geltungsbereich">
        <p>
          Diese Bedingungen regeln die Nutzung der App {companyInfo.brand} der {companyInfo.legalName}{' '}
          („Anbieter“) für die Suche von Ladestationen, die Abwicklung von Ladevorgängen und
          Bonusprogramme. Abweichende Bedingungen des Nutzers gelten nicht.
        </p>
      </LegalSection>

      <LegalSection title="2. Vertragspartner & Leistung">
        <p>
          Der Ladevertrag über die Energieleistung kommt mit dem jeweiligen Betreiber der Ladestation
          zustande. Die App vermittelt technische Informationen, Zahlungsabwicklung und
          Kundenkonto-Funktionen. Verfügbarkeit und Preise können je nach Standort variieren.
        </p>
      </LegalSection>

      <LegalSection title="3. Registrierung & Konto">
        <p>
          Für das Laden ist ein Nutzerkonto erforderlich. Zugangsdaten sind geheim zu halten. Der
          Nutzer stellt wahrheitsgemäße Angaben bereit. Details zur Datenverarbeitung:{' '}
          <Link to="/datenschutz" className="text-bc-accent">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="4. Preise & Zahlung">
        <p>
          Es gelten die am Ladepunkt bzw. in der App angezeigten Preise inkl. ausgewiesener
          Bestandteile (z. B. kWh-Preis, Startgebühr). Die Zahlung erfolgt über hinterlegte
          Zahlungsmittel (Karte/SEPA) über unseren Zahlungsdienstleister (siehe Datenschutzerklärung).
        </p>
      </LegalSection>

      <LegalSection title="5. Widerruf (Verbraucher)">
        <p>
          Bei Verträgen über die Lieferung von Strom an öffentliche Ladepunkte für Elektrofahrzeuge
          kann ein Widerrufsrecht nach § 312g Abs. 2 Nr. 2 BGB ausgeschlossen sein, wenn die
          Leistung vollständig erbracht wurde und Sie dem ausdrücklich zugestimmt haben. Nach
          Beginn eines konkreten Ladevorgangs ist eine Rückabwicklung der verbrauchten Energie
          regelmäßig ausgeschlossen. Bei berechtigten Beanstandungen wenden Sie sich an{' '}
          <a href={`mailto:${companyInfo.emailSupport}`} className="text-bc-accent">
            {companyInfo.emailSupport}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Pflichten des Nutzers">
        <p>
          Missbrauch (z. B. Manipulation von Ladepunkten, falsche Meldungen, Umgehung von
          Zahlungssystemen) ist untersagt. Parkplatz- und Verkehrsregeln am Standort sind einzuhalten.
        </p>
      </LegalSection>

      <LegalSection title="7. Haftung">
        <p>
          Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
          Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet der
          Anbieter bei leichter Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten,
          begrenzt auf den vorhersehbaren, typischen Schaden.
        </p>
      </LegalSection>

      <LegalSection title="8. Schlussbestimmungen">
        <p>
          Es gilt deutsches Recht. Gerichtsstand für Kaufleute ist Leipzig, sofern zulässig. Sollten
          einzelne Klauseln unwirksam sein, bleibt der Vertrag im Übrigen wirksam.{' '}
          <Link to="/impressum" className="text-bc-accent">
            Impressum
          </Link>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
