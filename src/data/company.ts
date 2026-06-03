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
  website: 'https://bc-charge.com',
  websiteByteCommander: 'https://byte-commander.de',
  supportHours: 'Mo–Fr 08:00–17:00 Uhr',
} as const;

export const companyAddressLines = [
  companyInfo.legalName,
  companyInfo.street,
  `${companyInfo.zip} ${companyInfo.city}`,
] as const;
