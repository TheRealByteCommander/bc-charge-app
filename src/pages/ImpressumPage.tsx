import { companyInfo } from '../data/company';
import { LegalPageLayout, LegalSection } from '../components/LegalPageLayout';

export function ImpressumPage() {
  return (
    <LegalPageLayout title="Impressum" subtitle={`Angaben gemäß § 5 TMG · ${companyInfo.brand}`}>
      <LegalSection title="Anbieter">
        <p>
          {companyInfo.legalName}
          <br />
          {companyInfo.street}
          <br />
          {companyInfo.zip} {companyInfo.city}
          <br />
          {companyInfo.country}
        </p>
      </LegalSection>

      <LegalSection title="Vertreten durch">
        <p>{companyInfo.managingDirector} (Geschäftsführer)</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
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
          Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            className="text-bc-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
