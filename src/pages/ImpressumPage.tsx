import { companyInfo } from '../data/company';
import { LegalPageLayout, LegalSection } from '../components/LegalPageLayout';

export function ImpressumPage() {
  return (
    <LegalPageLayout
      title="Impressum"
      subtitle={`Angaben gemäß § 5 DDG · ${companyInfo.brand} · Stand Juli 2026`}
    >
      <LegalSection title="Anbieter">
        <p>
          {companyInfo.legalName} ({companyInfo.legalForm})
          <br />
          {companyInfo.street}
          <br />
          {companyInfo.zip} {companyInfo.city}
          <br />
          {companyInfo.country}
        </p>
      </LegalSection>

      <LegalSection title="Vertretungsberechtigte">
        <p>{companyInfo.managingDirector} (Geschäftsführer)</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
          Website:{' '}
          <a href={companyInfo.website} className="text-bc-accent" target="_blank" rel="noopener noreferrer">
            {companyInfo.website.replace('https://', '')}
          </a>
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
          <br />
          Support: {companyInfo.supportHours}
        </p>
      </LegalSection>

      <LegalSection title="Registereintrag">
        <p>
          Eingetragen im {companyInfo.registerType}
          <br />
          Registergericht: {companyInfo.registerCourt}
          <br />
          Registernummer: {companyInfo.registerNumber}
        </p>
      </LegalSection>

      <LegalSection title="Umsatzsteuer">
        <p>{companyInfo.vatIdNote}</p>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)">
        <p>
          {companyInfo.managingDirector}
          <br />
          {companyInfo.street}, {companyInfo.zip} {companyInfo.city}
        </p>
      </LegalSection>

      <LegalSection title="Streitbeilegung">
        <p>
          Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen. Informationen zur außergerichtlichen
          Streitbeilegung für Verbraucherinnen und Verbraucher in der EU:{' '}
          <a
            href="https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/resolve-your-consumer-complaint/alternative-dispute-resolution-consumers_de"
            className="text-bc-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            Europäische Kommission – Alternative Streitbeilegung
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
