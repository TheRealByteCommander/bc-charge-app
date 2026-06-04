# BC Charge App

Mobile-first Web-App für **BC Charge** (Charge Point Operator) – öffentliches Laden mit Karten, Live-Session, Zahlung, BC-Points-Loyalty und Kundenbindung.

## Funktionen

- Onboarding, Registrierung & Anmeldung (lokal persistiert)
- Interaktive Karte mit allen Ladestationen (Leaflet / Dark OSM)
- Stationssuche, Filter, Favoriten, Detail & Navigation
- QR-/Kamera-Scan & manuelle Ladepunkt-ID
- Live-Ladevorgang mit kWh, Kosten und BC Points
- Ladehistorie mit Rechnungsreferenz
- BC Points, Stufen, Prämien-Einlösung, Mitgliedschafts-QR
- Fahrzeuge & Zahlungsmethoden
- Tarife, Roaming-Info, Benachrichtigungen, Support (bc-charge.com)

## Demo-Zugang

- E-Mail: `demo@bc-charge.com`
- Passwort: `demo123`

## Start

**Node.js 18+ ist Pflicht** (Vite 5, ESLint 9). Unter Windows liegt oft noch Node 16 im PATH – dann schlagen `npm run dev` / `npm run build` fehl.

### Windows: Node 22 aus Cursor nutzen

In **derselben** Eingabeaufforderung vor `npm install` / `npm run dev`:

```bat
set PATH=D:\cursor\resources\app\resources\helpers;%PATH%
node -v
```

Erwartet: `v22.x` (nicht `v16.x`). Alternativ Doppelklick auf `dev-start.cmd` im Projektordner.

Dauerhaft: [nodejs.org](https://nodejs.org/) LTS installieren und PATH prüfen (`where node`).

```bash
cd Projects/bc-charge-app
npm install
npm run dev
```

Browser: http://localhost:5173/

## Technik

React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router, Framer Motion, Leaflet.

## CitrineOS Backend (v1.8.4)

Die App nutzt die **CitrineOS REST-API** (OCPP 2.0.1):

| Funktion | API |
|----------|-----|
| Ladestart | `POST /ocpp/2.0.1/evdriver/requestStartTransaction` |
| Ladestopp | `POST /ocpp/2.0.1/evdriver/requestStopTransaction` |
| Transaktion | `GET /data/transactions/transactionType` |
| Tarife | `GET /data/transactions/tariff` |
| Stationen | Hasura GraphQL (`ChargingStation`) |
| Dokumentation | `http://localhost:8080/docs` |

### CitrineOS starten

```bash
git clone https://github.com/citrineos/citrineos-core
cd citrineos-core/Server
docker compose up -d
```

Kopieren Sie `.env.example` nach `.env` und passen Sie URLs an.

Ohne laufendes CitrineOS bleiben die **Demo-Stationen** und die **lokale Ladesimulation** aktiv. Konto und BC Points werden im Browser (localStorage) gehalten.

## Produkt-Roadmap (Marktführer-Ziel)

Vollständiges Backlog und Phasen: **[docs/PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md)**  
In der App: **Profil → Produkt-Roadmap** oder `/roadmap`.

**MVP in dieser Version (PWA):** erweiterte Filter, PlugScore & Community-Meldungen, Reiseplaner (Basis), OCPI/Roaming-Übersicht, DE/EN, Offline-Cache, Gast-Zugang (Karte/Stationen ohne Login).

## Stripe-Zahlungen

- **Frontend:** Stripe Payment Element (`@stripe/react-stripe-js`)
- **Backend:** Express-API unter Port `4242` (`server/index.ts`)
- Speichern von Karten/SEPA via SetupIntent
- Abbuchung nach Ladeende via PaymentIntent (off-session)

```bash
# .env mit sk_test_… und pk_test_… befüllen
npm run dev:all
```

Einzeln: `npm run dev` + `npm run dev:stripe`

## Sicherheit & Datenschutz

- **`SECURITY.md`** – Risiken, umgesetzte Maßnahmen, Produktions-Checkliste
- **`.env`**: `BC_STRIPE_API_KEY` und `VITE_BC_STRIPE_API_KEY` (gleicher Wert, min. 32 Zeichen) für den Stripe-BFF
- Datenschutz in der App: **Profil → Datenschutz** (`/datenschutz`)

## Hinweis

Für Produktion: echte Server-Auth, keine PII in localStorage, Stripe-Webhooks, Hasura-Admin **nicht** im Frontend. Siehe `SECURITY.md`.
