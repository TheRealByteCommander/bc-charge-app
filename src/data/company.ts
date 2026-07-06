/** Zentrale Kontakt- und Impressumsdaten (Byte Commander GmbH / BC Charge). */
export const companyInfo = {
  legalName: 'Byte Commander GmbH',
  legalForm: 'GmbH',
  brand: 'BC Charge',
  street: 'Grüner Weg 3',
  zip: '04827',
  city: 'Machern',
  region: 'Landkreis Leipzig · Sachsen',
  country: 'Deutschland',
  phone: '+49 34292 43340',
  phoneDisplay: '+49 (0) 34292 43340',
  phoneTel: '+493429243340',
  emailLegal: 'info@byte-commander.de',
  emailSupport: 'info@byte-commander.de',
  emailPrivacy: 'info@byte-commander.de',
  website: 'https://main.bc-charge.com',
  /** Öffentliche Marketing-Domain (Support, Impressum-Anzeige) */
  websitePublic: 'https://bc-charge.com',
  websiteDisplay: 'bc-charge.com',
  websiteByteCommander: 'https://byte-commander.de',
  supportHours: 'Mo–Fr 08:00–17:00 Uhr',
  /** DDG § 5 */
  managingDirector: 'Matthias Schmitz',
  registerType: 'Handelsregister',
  registerCourt: 'Amtsgericht Leipzig',
  registerNumber: 'HRB 38559',
  vatId: 'DE343089057',
  /** Steuernummer des Finanzamts (optional, z. B. über BC_TAX_NUMBER) */
  taxNumber: undefined as string | undefined,
  vatIdNote: 'USt-IdNr. DE343089057',
} as const;

export const companyAddressLines = [
  companyInfo.legalName,
  companyInfo.street,
  `${companyInfo.zip} ${companyInfo.city}`,
] as const;

/** Akzeptierte Zahlungsmethoden (Anzeige in Hilfe, Zahlung, FAQ). */
export const acceptedPaymentMethods = {
  de: ['Apple Pay', 'Kreditkarte', 'SEPA-Lastschrift'] as const,
  en: ['Apple Pay', 'Credit card', 'SEPA direct debit'] as const,
};

export function formatAcceptedPaymentMethods(locale: 'de' | 'en'): string {
  return acceptedPaymentMethods[locale].join(', ');
}

/** Beschwerdestelle Datenschutz (Sachsen). */
export const dataProtectionAuthority = {
  name: 'Sächsische Datenschutz- und Transparenzbeauftragte',
  street: 'Maternistraße 17',
  zip: '01067',
  city: 'Dresden',
  phone: '+49 351 85471-101',
  email: 'post@sdtb.sachsen.de',
  website: 'https://www.datenschutz.sachsen.de',
} as const;
