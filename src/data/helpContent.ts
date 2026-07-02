import type { Locale } from '../i18n/messages';

export type HelpFaqCategory = 'all' | 'charging' | 'payment' | 'account' | 'technical';

export type HelpGuideId =
  | 'account-charge'
  | 'guest-charge'
  | 'qr-scan'
  | 'payment'
  | 'points'
  | 'pwa';

export interface HelpGuide {
  id: HelpGuideId;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  steps: Record<Locale, string[]>;
  link?: { to: string; label: Record<Locale, string> };
}

export interface HelpFaq {
  id: string;
  category: Exclude<HelpFaqCategory, 'all'>;
  question: Record<Locale, string>;
  answer: Record<Locale, string>;
}

export const helpGuides: HelpGuide[] = [
  {
    id: 'account-charge',
    title: {
      de: 'Mit Konto laden',
      en: 'Charge with an account',
    },
    summary: {
      de: 'Registriert, Fahrzeug & Zahlung hinterlegt – der Standardweg.',
      en: 'Registered, with vehicle and payment saved – the standard flow.',
    },
    steps: {
      de: [
        'Konto anlegen oder anmelden.',
        'Unter Profil → Fahrzeuge ein Fahrzeug hinzufügen.',
        'Unter Profil → Zahlung Karte oder SEPA hinterlegen.',
        'Station auf der Karte öffnen, freien Anschluss wählen.',
        '„Laden starten“ tippen und den Vorgang bestätigen.',
        'Nach dem Laden „Laden beenden“ – die Zahlung erfolgt automatisch.',
      ],
      en: [
        'Create an account or sign in.',
        'Add a vehicle under Profile → Vehicles.',
        'Add a card or SEPA under Profile → Payment.',
        'Open a station on the map and pick an available connector.',
        'Tap “Start charging” and confirm.',
        'When finished, tap “Stop charging” – payment is automatic.',
      ],
    },
    link: { to: '/scan', label: { de: 'Zur Stationssuche', en: 'Find a station' } },
  },
  {
    id: 'guest-charge',
    title: {
      de: 'Ohne Konto laden (Ad-Hoc)',
      en: 'Charge without account (ad-hoc)',
    },
    summary: {
      de: 'QR-Code an der Säule scannen, mit Karte bezahlen – ohne Registrierung.',
      en: 'Scan the QR code at the station, pay by card – no registration.',
    },
    steps: {
      de: [
        'QR-Code an der Ladesäule scannen (oder Ladepunkt-ID eingeben).',
        'Anschluss wählen, falls die Station mehrere Ladepunkte hat.',
        '„Ad-Hoc laden“ oder „Weiter zur Zahlung“ wählen.',
        'Kartendaten eingeben – es wird eine Vorautorisierung vorgenommen.',
        'Nach erfolgreicher Zahlung startet der Ladevorgang.',
        'Zum Beenden „Laden beenden“ tippen – der tatsächliche Betrag wird abgebucht.',
      ],
      en: [
        'Scan the QR code on the charger (or enter the charging point ID).',
        'Select a connector if the station has multiple outlets.',
        'Choose “Ad-hoc charge” or “Continue to payment”.',
        'Enter card details – a pre-authorization is placed on your card.',
        'After successful payment, charging starts.',
        'Tap “Stop charging” when done – the final amount is captured.',
      ],
    },
    link: { to: '/scan', label: { de: 'QR scannen', en: 'Scan QR code' } },
  },
  {
    id: 'qr-scan',
    title: {
      de: 'QR-Code & Ladepunkt-ID',
      en: 'QR code & charging point ID',
    },
    summary: {
      de: 'So finden Sie die richtige Station schnell.',
      en: 'How to find the right station quickly.',
    },
    steps: {
      de: [
        'Unten „Start“ (QR-Symbol) öffnen oder auf der Startseite „Ladepunkt-ID eingeben“.',
        'Kamera erlauben und den QR-Code an der Säule scannen.',
        'Alternativ die Ladepunkt-ID von der Beschriftung manuell eingeben.',
        'Die App öffnet die Stationsseite mit Tarif und Verfügbarkeit.',
      ],
      en: [
        'Open “Start” (QR icon) in the bottom bar or “Enter charging point ID” on home.',
        'Allow camera access and scan the QR code on the charger.',
        'Or enter the charging point ID from the label manually.',
        'The app opens the station page with tariff and availability.',
      ],
    },
    link: { to: '/scan', label: { de: 'Scanner öffnen', en: 'Open scanner' } },
  },
  {
    id: 'payment',
    title: {
      de: 'Zahlung & Abrechnung',
      en: 'Payment & billing',
    },
    summary: {
      de: 'Zahlungsmethoden, Abrechnung nach der Session, Rechnungsprüfung.',
      en: 'Payment methods, billing after sessions, invoice checks.',
    },
    steps: {
      de: [
        'Zahlungsmethode unter Profil → Zahlung hinterlegen (Karte oder SEPA).',
        'Nach jedem Ladevorgang wird der Betrag automatisch abgebucht.',
        'Details finden Sie unter Profil → Ladehistorie.',
        'Bei Unstimmigkeiten: „Rechnung prüfen / Support“ in der Historie.',
      ],
      en: [
        'Add a payment method under Profile → Payment (card or SEPA).',
        'After each session the amount is charged automatically.',
        'See details under Profile → Charging history.',
        'If something looks wrong: “Check invoice / Support” in history.',
      ],
    },
    link: { to: '/zahlung', label: { de: 'Zahlung einrichten', en: 'Set up payment' } },
  },
  {
    id: 'points',
    title: {
      de: 'BC Points & Vorteile',
      en: 'BC Points & perks',
    },
    summary: {
      de: 'Punkte sammeln, Stufen aufsteigen, Prämien einlösen.',
      en: 'Collect points, level up, redeem rewards.',
    },
    steps: {
      de: [
        'Bei jedem abgeschlossenen Ladevorgang sammeln Sie BC Points.',
        'Höhere Mitgliedsstufen (Silber, Gold, …) bringen Bonus-Multiplikatoren.',
        'Unter „Vorteile“ sehen Sie Punktestand, Abzeichen und einlösbare Prämien.',
        'Ad-Hoc-Gäste ohne Konto sammeln keine Punkte.',
      ],
      en: [
        'You earn BC Points with every completed charging session.',
        'Higher membership tiers (Silver, Gold, …) give bonus multipliers.',
        'Under “Perks” you see points, badges and redeemable rewards.',
        'Ad-hoc guests without an account do not collect points.',
      ],
    },
    link: { to: '/vorteile', label: { de: 'Zu den Vorteilen', en: 'View perks' } },
  },
  {
    id: 'pwa',
    title: {
      de: 'App auf dem Handy installieren',
      en: 'Install the app on your phone',
    },
    summary: {
      de: 'BC Charge als App-Icon auf Start- oder Homescreen.',
      en: 'BC Charge as an app icon on your home screen.',
    },
    steps: {
      de: [
        'Website main.bc-charge.com im Browser öffnen (Chrome, Safari, …).',
        'Android/Chrome: Menü → „Zum Startbildschirm hinzufügen“.',
        'iPhone/Safari: Teilen-Symbol → „Zum Home-Bildschirm“.',
        'Die App funktioniert auch offline eingeschränkt (Karte, zwischengespeicherte Stationen).',
      ],
      en: [
        'Open main.bc-charge.com in your browser (Chrome, Safari, …).',
        'Android/Chrome: Menu → “Add to Home screen”.',
        'iPhone/Safari: Share icon → “Add to Home Screen”.',
        'The app works with limited offline features (map, cached stations).',
      ],
    },
  },
];

export const helpFaqs: HelpFaq[] = [
  {
    id: 'start-charge',
    category: 'charging',
    question: {
      de: 'Wie starte ich eine Ladung?',
      en: 'How do I start charging?',
    },
    answer: {
      de: 'Mit Konto: Station öffnen, Anschluss wählen, „Laden starten“. Ohne Konto: QR-Code scannen und Ad-Hoc-Flow nutzen. Voraussetzung mit Konto: Fahrzeug und Zahlungsmethode hinterlegt.',
      en: 'With account: open station, pick connector, tap “Start charging”. Without account: scan QR and use ad-hoc flow. With account you need a vehicle and payment method saved.',
    },
  },
  {
    id: 'multi-connector',
    category: 'charging',
    question: {
      de: 'Die Station hat zwei Ladepunkte – welchen wähle ich?',
      en: 'The station has two connectors – which one do I pick?',
    },
    answer: {
      de: 'Wählen Sie den Anschluss, an dem Ihr Fahrzeug physisch angeschlossen ist (Ladepunkt 1 oder 2). Bei Unsicherheit: LED-Status in der App prüfen – „Verfügbar“ bedeutet frei.',
      en: 'Pick the connector where your vehicle is physically plugged in (outlet 1 or 2). If unsure, check the LED status in the app – “Available” means free.',
    },
  },
  {
    id: 'stop-charge',
    category: 'charging',
    question: {
      de: 'Laden lässt sich nicht beenden?',
      en: 'Cannot stop charging?',
    },
    answer: {
      de: 'Auf der Ladevorgangs-Seite „Problem beim Beenden?“ nutzen: Hotline mit Session-ID oder Notfall-E-Mail. Wir stoppen den Vorgang remote. Session-ID steht auf der Lade-Seite.',
      en: 'On the charging page use “Problem stopping?”: hotline with session ID or emergency email. We stop the session remotely. Session ID is shown on the charging page.',
    },
  },
  {
    id: 'station-offline',
    category: 'technical',
    question: {
      de: 'Station wird als offline angezeigt',
      en: 'Station shows as offline',
    },
    answer: {
      de: 'Die Säule ist nicht mit dem Backend verbunden. Bitte später erneut versuchen oder uns kontaktieren. Sie können trotzdem eine Community-Meldung auf der Stationsseite senden.',
      en: 'The charger is not connected to the backend. Try again later or contact us. You can still send a community report on the station page.',
    },
  },
  {
    id: 'adhoc-preauth',
    category: 'payment',
    question: {
      de: 'Warum wird bei Ad-Hoc eine Vorautorisierung abgebucht?',
      en: 'Why is ad-hoc charging pre-authorized?',
    },
    answer: {
      de: 'Zur Sicherheit wird vor dem Laden ein Betrag auf Ihrer Karte reserviert (Vorautorisierung). Nach Ladeende wird nur der tatsächliche Verbrauch abgebucht, der Rest der Reservierung wird freigegeben.',
      en: 'For security, an amount is reserved on your card before charging (pre-authorization). After charging, only the actual usage is captured; the rest of the hold is released.',
    },
  },
  {
    id: 'payment-methods',
    category: 'payment',
    question: {
      de: 'Welche Zahlungsarten werden akzeptiert?',
      en: 'Which payment methods are accepted?',
    },
    answer: {
      de: 'Mit Konto: Kredit-/Debitkarte und SEPA-Lastschrift unter Profil → Zahlung. Ad-Hoc: Karte über Stripe Payment Element (kein Konto nötig).',
      en: 'With account: credit/debit card and SEPA under Profile → Payment. Ad-hoc: card via Stripe (no account needed).',
    },
  },
  {
    id: 'invoice-dispute',
    category: 'payment',
    question: {
      de: 'Rechnung stimmt nicht?',
      en: 'Invoice amount incorrect?',
    },
    answer: {
      de: 'In der Ladehistorie „Rechnung prüfen / Support“ wählen – Ihre Session-Daten werden automatisch an unser Team übermittelt.',
      en: 'In charging history choose “Check invoice / Support” – your session data is sent to our team automatically.',
    },
  },
  {
    id: 'blocking-fees',
    category: 'payment',
    question: {
      de: 'Fallen Blockiergebühren an?',
      en: 'Are idle/blocking fees charged?',
    },
    answer: {
      de: 'Nein. BC Charge erhebt keine Blockier- oder Standgebühren nach dem Laden. Abgerechnet wird die geladene Energie (kWh) – transparent vor dem Ladevorgang.',
      en: 'No. BC Charge does not charge idle or blocking fees after charging. You pay for energy (kWh) – shown transparently before you start.',
    },
  },
  {
    id: 'bc-points',
    category: 'account',
    question: {
      de: 'Wie sammle ich BC Points?',
      en: 'How do I collect BC Points?',
    },
    answer: {
      de: 'Automatisch bei jeder abgeschlossenen Ladung mit registriertem Konto. Höhere Mitgliedsstufen bringen Multiplikatoren. Details unter „Vorteile“.',
      en: 'Automatically with every completed session on a registered account. Higher tiers give multipliers. See “Perks” for details.',
    },
  },
  {
    id: 'accessibility',
    category: 'account',
    question: {
      de: 'Größere Schrift oder einfachere Bedienung?',
      en: 'Larger text or simpler UI?',
    },
    answer: {
      de: 'Unter Profil → Barrierefreiheit (oder /barrierefreiheit): Schriftgröße, hoher Kontrast und einfache Ansicht einstellbar.',
      en: 'Under Profile → Accessibility (or /barrierefreiheit): adjust text size, high contrast and simple mode.',
    },
  },
  {
    id: 'location-camera',
    category: 'technical',
    question: {
      de: 'Warum fragt die App nach Standort oder Kamera?',
      en: 'Why does the app ask for location or camera?',
    },
    answer: {
      de: 'Standort: Entfernung zu Stationen auf der Karte (nur nach Einwilligung). Kamera: QR-Scanner und optionale Fotos bei Community-Meldungen. Details in der Datenschutzerklärung.',
      en: 'Location: distance to stations on the map (only with consent). Camera: QR scanner and optional photos for community reports. See privacy policy for details.',
    },
  },
  {
    id: 'pwa-update',
    category: 'technical',
    question: {
      de: 'Die App zeigt ein Update an – was tun?',
      en: 'The app shows an update – what should I do?',
    },
    answer: {
      de: 'Auf „Aktualisieren“ tippen oder die Seite neu laden. Bei installierter PWA: App schließen und neu öffnen. Bei anhaltenden Problemen: App vom Startbildschirm entfernen und neu installieren.',
      en: 'Tap “Update” or reload the page. For installed PWA: close and reopen the app. If issues persist: remove from home screen and install again.',
    },
  },
];

export const helpFaqCategoryLabels: Record<HelpFaqCategory, Record<Locale, string>> = {
  all: { de: 'Alle', en: 'All' },
  charging: { de: 'Laden', en: 'Charging' },
  payment: { de: 'Zahlung', en: 'Payment' },
  account: { de: 'Konto', en: 'Account' },
  technical: { de: 'Technik', en: 'Technical' },
};
