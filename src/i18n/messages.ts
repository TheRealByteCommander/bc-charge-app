export type Locale = 'de' | 'en';

export const messages = {
  de: {
    nav: { home: 'Start', map: 'Karte', scan: 'Scan', perks: 'Vorteile', profile: 'Profil', trip: 'Reise' },
    filters: {
      title: 'Filter',
      availableOnly: 'Nur verfügbar',
      connector: 'Stecker',
      minPower: 'Min. Leistung (kW)',
      maxPrice: 'Max. Preis/kWh',
      greenOnly: 'Nur Ökostrom',
      accessibleOnly: 'Barrierefrei',
      amenities: 'Am Standort',
      reset: 'Zurücksetzen',
    },
    plugScore: 'PlugScore',
    trip: {
      title: 'Reiseplanung',
      destination: 'Ziel (Stadt oder Adresse)',
      plan: 'Route planen',
      stops: 'Lade-Stopps',
      openMaps: 'In Karten öffnen',
    },
    guest: {
      hint: 'Ohne Konto: Karte & Stationen nutzen. Zum Laden bitte anmelden.',
      login: 'Anmelden',
    },
  },
  en: {
    nav: { home: 'Home', map: 'Map', scan: 'Scan', perks: 'Perks', profile: 'Profile', trip: 'Trip' },
    filters: {
      title: 'Filters',
      availableOnly: 'Available only',
      connector: 'Connector',
      minPower: 'Min. power (kW)',
      maxPrice: 'Max. price/kWh',
      greenOnly: 'Green energy only',
      accessibleOnly: 'Accessible',
      amenities: 'On site',
      reset: 'Reset',
    },
    plugScore: 'PlugScore',
    trip: {
      title: 'Trip planning',
      destination: 'Destination (city or address)',
      plan: 'Plan route',
      stops: 'Charging stops',
      openMaps: 'Open in maps',
    },
    guest: {
      hint: 'Without account: use map & stations. Sign in to charge.',
      login: 'Sign in',
    },
  },
} as const;

export type MessageKey = keyof typeof messages.de;
