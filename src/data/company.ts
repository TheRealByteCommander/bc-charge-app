/** Zentrale Kontakt- und Impressumsdaten (Byte Commander GmbH / BC Charge). */
export const companyInfo = {
  legalName: 'Byte Commander GmbH',
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
  website: 'https://bc-charge.com',
  websiteByteCommander: 'https://byte-commander.de',
  supportHours: 'Mo–Fr 08:00–17:00 Uhr',
  /** TMG § 5 */
  managingDirector: 'Matthias Schmitz',
  registerCourt: 'Amtsgericht Leipzig',
  registerNumber: 'HRB 38559',
  /** Wird auf Rechnungen ausgewiesen, sofern vorhanden */
  vatIdNote: 'Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG auf Anfrage',
} as const;

export const companyAddressLines = [
  companyInfo.legalName,
  companyInfo.street,
  `${companyInfo.zip} ${companyInfo.city}`,
] as const;

/** Beschwerdestelle Datenschutz (Sachsen). */
export const dataProtectionAuthority = {
  name: 'Sächsischer Datenschutzbeauftragter',
  street: 'Devrientstraße 5',
  zip: '01067',
  city: 'Dresden',
  phone: '+49 351 85471-101',
  email: 'poststelle@sdbs.sachsen.de',
  website: 'https://www.saechsdsb.de',
} as const;
