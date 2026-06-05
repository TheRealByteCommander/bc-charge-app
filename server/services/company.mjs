/** Anbieterdaten für Rechnungen (entspricht src/data/company.ts). */
export const companyInfo = {
  legalName: 'Byte Commander GmbH',
  brand: 'BC Charge',
  street: 'Grüner Weg 3',
  zip: '04827',
  city: 'Machern',
  country: 'Deutschland',
  phone: '+49 34292 43340',
  email: process.env.BC_INVOICE_COPY_EMAIL ?? 'invoice@bc-charge.com',
  managingDirector: 'Matthias Schmitz',
  registerCourt: 'Amtsgericht Leipzig',
  registerNumber: 'HRB 38559',
  vatIdNote: 'Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG auf Anfrage',
};
