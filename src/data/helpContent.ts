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
        'Unter Profil → Zahlung eine Zahlungsmethode hinterlegen: Apple Pay, Kreditkarte oder SEPA-Lastschrift.',
        'Station auf der Karte öffnen, freien Anschluss wählen.',
        '„Laden starten“ tippen und den Vorgang bestätigen.',
        'Nach dem Laden „Laden beenden“ – danach erfolgt die Abrechnung automatisch.',
      ],
      en: [
        'Create an account or sign in.',
        'Add a vehicle under Profile → Vehicles.',
        'Add Apple Pay, credit card or SEPA direct debit under Profile → Payment.',
        'Open a station on the map and pick an available connector.',
        'Tap “Start charging” and confirm.',
        'When finished, tap “Stop charging” – billing then happens automatically.',
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
        'Auf der Stationsseite „Ad-Hoc laden“ wählen oder im Ad-Hoc-Flow „Weiter zur Zahlung“.',
        'Optional E-Mail für den Beleg angeben, dann Kartendaten eingeben – es wird eine Vorautorisierung vorgenommen (noch keine Endabrechnung).',
        'Nach erfolgreicher Vorautorisierung startet der Ladevorgang.',
        'Zum Beenden „Laden beenden“ tippen – danach wird der tatsächliche Betrag abgebucht.',
      ],
      en: [
        'Scan the QR code on the charger (or enter the charging point ID).',
        'Select a connector if the station has multiple outlets.',
        'On the station page choose “Ad-hoc charge” or “Continue to payment” in the ad-hoc flow.',
        'Optionally add an email for the receipt, then enter card details – a pre-authorization is placed (not the final charge yet).',
        'After successful authorization, charging starts.',
        'Tap “Stop charging” when done – the final amount is then captured.',
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
        'Unten in der Navigation „Start“ (QR-Symbol) öffnen.',
        'QR-Code an der Säule scannen (Kamera-Zugriff erlauben) oder Ladepunkt-ID von der Beschriftung eingeben.',
        'Mit Konto geht das auch über die Startseite → „Ladepunkt-ID eingeben“.',
        'Die App öffnet die Stationsseite mit Tarif und Verfügbarkeit.',
      ],
      en: [
        'Open “Start” (QR icon) in the bottom navigation.',
        'Scan the QR code on the charger (allow camera access) or enter the charging point ID from the label.',
        'With an account you can also use Home → “Enter charging point ID”.',
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
        'Zahlungsmethode unter Profil → Zahlung hinterlegen (Apple Pay, Kreditkarte, SEPA-Lastschrift).',
        'Der Tarif pro kWh ist vor dem Start auf der Stationsseite sichtbar.',
        'Nach Ladeende wird der Betrag automatisch abgebucht – auf Basis der tatsächlich geladenen Energie.',
        'Rechnung und Details finden Sie unter Profil → Ladehistorie (PDF-Download).',
        'Bei Unstimmigkeiten: „Rechnung prüfen / Support“ in der Historie – Session-Daten werden für die E-Mail vorausgefüllt.',
      ],
      en: [
        'Add a payment method under Profile → Payment (Apple Pay, credit card, SEPA direct debit).',
        'The price per kWh is shown on the station page before you start.',
        'After charging ends, the amount is charged automatically based on energy actually delivered.',
        'Invoice and details are available under Profile → Charging history (PDF download).',
        'If something looks wrong: “Check invoice / Support” in history – session data is pre-filled in the email.',
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
        'Nach Einlösung: Gutscheincodes unter „Meine Prämien“, Ladeprämien beim nächsten Start wählbar.',
        'Ad-Hoc-Gäste ohne Konto sammeln keine Punkte.',
      ],
      en: [
        'You earn BC Points with every completed charging session.',
        'Higher membership tiers (Silver, Gold, …) give bonus multipliers.',
        'Under “Perks” you see points, badges and redeemable rewards.',
        'After redeeming: voucher codes under “My rewards”, charging perks selectable at next session start.',
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
        'Website bc-charge.com im Browser öffnen (Chrome, Safari, …).',
        'Android/Chrome: Menü → „Zum Startbildschirm hinzufügen“.',
        'iPhone/Safari: Teilen-Symbol → „Zum Home-Bildschirm“.',
        'Die App funktioniert auch offline eingeschränkt (Karte, zwischengespeicherte Stationen).',
      ],
      en: [
        'Open bc-charge.com in your browser (Chrome, Safari, …).',
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
      de: 'Wählen Sie den Anschluss, an dem Ihr Fahrzeug physisch angeschlossen ist (Ladepunkt 1 oder 2). Bei Unsicherheit: Anschlussstatus in der App prüfen – „Verfügbar“ bedeutet frei.',
      en: 'Pick the connector where your vehicle is physically plugged in (outlet 1 or 2). If unsure, check connector status in the app – “Available” means free.',
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
      de: 'Warum wird bei Ad-Hoc eine Vorautorisierung vorgenommen?',
      en: 'Why is ad-hoc charging pre-authorized?',
    },
    answer: {
      de: 'Zur Sicherheit wird vor dem Laden ein Betrag auf Ihrer Karte reserviert (Vorautorisierung) – das ist noch keine Endabrechnung. Nach Ladeende wird nur der tatsächliche Verbrauch abgebucht, der Rest der Reservierung wird freigegeben.',
      en: 'For security, an amount is reserved on your card before charging (pre-authorization) – this is not the final charge. After charging, only the actual usage is captured; the rest of the hold is released.',
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
      de: 'Wir akzeptieren Apple Pay, Kreditkarte und SEPA-Lastschrift. Mit Konto unter Profil → Zahlung hinterlegen. Ad-Hoc ohne Konto: Apple Pay oder Kreditkarte beim QR-Laden.',
      en: 'We accept Apple Pay, credit card and SEPA direct debit. With an account, add them under Profile → Payment. Ad-hoc without account: Apple Pay or credit card when charging via QR.',
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
      de: 'In der Ladehistorie „Rechnung prüfen / Support“ wählen – Ihre Session-Daten werden für die E-Mail an unser Team vorausgefüllt.',
      en: 'In charging history choose “Check invoice / Support” – your session data is pre-filled in the email to our team.',
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
      de: 'Nein. BC Charge erhebt keine Blockier- oder Standgebühren nach dem Laden. Der Tarif pro kWh ist vor dem Start sichtbar; abgerechnet wird nach Ladeende nur die tatsächlich geladene Energie (kWh).',
      en: 'No. BC Charge does not charge idle or blocking fees after charging. The price per kWh is shown before you start; you are billed after charging for the energy actually delivered (kWh).',
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
