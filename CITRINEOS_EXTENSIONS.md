# CitrineOS Feature Extensions – Technische Roadmap (OCPP 1.6)

**Projekt:** BC Charge CPO Backend Extension  
**Ziel:** CitrineOS-Fähigkeiten auf professionelle CPO-Standards erweitern.

## Architektur: CitrineOS Server vs. BC Charge App Server

| Komponente | Repository / Host | Verantwortung |
|------------|-------------------|---------------|
| **CitrineOS Server** | [`bc-citrineos`](https://github.com/TheRealByteCommander/bc-citrineos) | OCPP-Gateway, Hasura, Ladepunkt-Steuerung (`SetChargingProfile`, `MeterValues`, `StatusNotification`) |
| **BC Charge App Server** | `bc-charge-app` → `server/` (Port 4242) | BFF: Auth, Sessions, Stripe, Tarif-/Abrechnungslogik, Ladeoptimierung |
| **BC Charge Frontend** | `bc-charge-app` → `src/` | React-PWA, CitrineOS-Client (Hasura/REST), Live-Status |

Konfiguration und Skripte unter `config/citrineos/` und `scripts/citrineos/` in diesem Repo sind **Referenz für den CitrineOS-Stack** – Deployment erfolgt auf dem CitrineOS-Host bzw. in `bc-citrineos`, nicht nur über `npm run build` der App.

---

## 1. Intelligentes Lastmanagement & Grid-Optimierung

*Ziel: Vermeidung von Netzüberlastung und Optimierung der Energiekosten.*

### 1.1 Dynamisches Lastmanagement (DLM)

- **Beschreibung:** Zentrale Steuerungslogik, die die verfügbare Gesamtleistung eines Standorts überwacht.
- **Technische Umsetzung (CitrineOS Server):**
  - `LoadManager`-Service aggregiert aktive `MeterValues` (Leistung).
  - Bei Erreichen eines Schwellenwerts (Hausanschlusswert) werden Ladeleistungen proportional reduziert.
  - **OCPP-Befehl:** `SetChargingProfile` (Smart Charging).
- **Akzeptanzkriterium:** Keine Sicherungsauslösung bei gleichzeitigem Laden aller Säulen; Leistungsanpassung innerhalb von &lt; 5 Sekunden.
- **Status:** Geplant (CitrineOS Server)

### 1.2 Zeitgesteuerte Ladeoptimierung (Price-Driven)

- **Beschreibung:** Verschiebung von Ladezyklen in Zeitfenster mit niedrigen Strompreisen.
- **Technische Umsetzung (BC Charge App Server):**
  - Day-Ahead-Strompreisdaten (z. B. Entsoe-E).
  - Pausieren oder Drosseln, wenn der Preis einen Schwellenwert übersteigt (sofern keine Eil-Ladung).
  - **OCPP-Befehl:** `SetChargingProfile` mit Zeitplänen – ausgelöst über CitrineOS API.
  - **Implementierung:** `server/services/priceOptimization/`, API `/api/price-optimization`
  - **Dokumentation:** [`docs/price-driven-charging.md`](docs/price-driven-charging.md)
- **Akzeptanzkriterium:** Reduktion der Energiekosten pro kWh durch Verschiebung in Niedrigpreisphasen.
- **Status:** ✅ Implementiert (App Server) – *steuert Ladeleistung, keine Endabrechnung*

### 1.3 PV-Überschussladen

- **Beschreibung:** Priorisierung von lokal erzeugtem Solarstrom.
- **Technische Umsetzung (BC Charge App Server):**
  - API-Endpoint für externe Energiemanagementsysteme (EMS) zur Meldung des Solarüberschusses.
  - Ladeleistung wird linear an den gemeldeten Überschuss angepasst (`SetChargingProfile` via CitrineOS).
  - **Implementierung:** `server/services/pvSurplusCharging.mjs`, API `/api/pv-surplus`
  - **Dokumentation:** [`docs/pv-surplus-charging.md`](docs/pv-surplus-charging.md)
- **Akzeptanzkriterium:** Ladeleistung steigt/fällt synchron zum Solarertrag.
- **Status:** ✅ Implementiert (App Server)

---

## 2. Billing & Monetarisierung (Deep Integration)

*Ziel: Maximierung der Marge und Automatisierung der Abrechnung.*

### 2.1 Dynamic Pricing Engine

- **Beschreibung:** Flexible Preisgestaltung jenseits fixer kWh-Preise – **Abrechnung**, nicht Ladeoptimierung (siehe 1.2).
- **Technische Umsetzung (BC Charge App Server):**
  - **Zeitbasierte Tarife:** Tarifmatrix mit TOU-Fenstern (z. B. 06–22 Uhr Preis A, 22–06 Uhr Preis B), IANA-Zeitzone, DST-sicher.
  - **Idle Fees (Blockiergebühr):** Beginn **nur** nach belastbarem OCPP-Ladezustandswechsel:
    - Zuerst aktives Laden (`Charging` / `EVConnected`),
    - danach Übergang in `SuspendedEV`, `SuspendedEVSE` oder `Idle`.
    - **Nicht** auslösen durch allein konstante `MeterValues` ohne State-Wechsel.
    - Konfigurierbare Karenzzeit (`idleGraceSeconds`) pro Tarifkomponente.
    - Implementierung: `server/services/pricing/events.mjs` → `deriveIdleIntervals()`
  - **TariffSnapshot:** Unveränderlicher Tarif-Snapshot bei Session-Start (`attachTariffSnapshotToSession`).
  - **CostEngine:** Deterministische Kostenberechnung inkl. Energie, Zeit, Session, Idle, Min/Max-Preis.
  - **Energie-Pass-through:** Dynamische Kalkulation `Strompreis + Betriebskosten + Marge` als Tarifkomponente.
  - **Eichrecht:** Signierte `MeterValues` werden im Snapshot unverändert referenziert; Abrechnung bevorzugt MID-zertifizierte Werte.
  - **API:** `/api/pricing` (Tarife, Versionen, Vorschau, OCPI-Export, Audit)
  - **Dokumentation:** [`docs/dynamic-pricing-engine.md`](docs/dynamic-pricing-engine.md)
- **Akzeptanzkriterium:** Korrekte Idle-Fees in der Endabrechnung nur bei OCPP-State-Übergang; dynamische Preisanpassung im Backend ohne manuellen Eingriff pro Säule.
- **Status:** ✅ Implementiert (App Server + UI `TariffsPage`)

### 2.2 Automatisierte Abrechnungs-Workflows

- **Beschreibung:** Nahtlose Übergabe der Finanzdaten in die Buchhaltung.
- **Technische Umsetzung:**
  - Export-Modul für DATEV/Lexoffice (CSV/XML).
  - Aggregation von Transaktionen zu täglichen/monatlichen Summen pro Standort.
- **Akzeptanzkriterium:** Export-Datei ohne manuelle Korrektur importierbar.
- **Status:** Geplant

### 2.3 Multi-Tenant Revenue Sharing

- **Beschreibung:** Automatische Aufteilung von Einnahmen bei Partner-Standorten.
- **Technische Umsetzung:**
  - `LocationOwner`-Attribut in der Datenbank.
  - Split-Logik: `Brutto − Kosten = Netto → (X % Partner, Y % BC Charge)`.
- **Akzeptanzkriterium:** Automatische Abrechnungsberichte für Standortpartner.
- **Status:** Geplant

---

## 3. Operations & Maintenance (Reliability Layer)

*Ziel: Maximierung der Uptime und Minimierung der Support-Kosten.*

### 3.1 Predictive Maintenance Dashboard

- **Beschreibung:** Früherkennung von Hardwaredefekten durch Musteranalyse.
- **Technische Umsetzung (CitrineOS Server):**
  - Analyse von `StatusNotification` und `Error`-Events.
  - Identifikation von Flapping-Verhalten (Säule offline/online).
- **Akzeptanzkriterium:** Dashboard-Warnung vor Nutzermeldung eines Totalausfalls.
- **Status:** Geplant

### 3.2 Automatisierter Health-Check-Bot

- **Beschreibung:** Tägliche Validierung aller Ladepunkte.
- **Technische Umsetzung (CitrineOS Server):**
  - Cron-Job: `GetDiagnostics` / `GetStatus` an alle Säulen.
  - Bei Timeout: `Reset`, bei erneutem Fehler Ticket.
- **Akzeptanzkriterium:** Tägliche Liste „unhealthy“ Säulen vor erstem Kundenkontakt.
- **Status:** Geplant

### 3.3 Remote Diagnostics Tool

- **Beschreibung:** Support-Werkzeug zur schnellen Fehlerursachenanalyse.
- **Technische Umsetzung:**
  - OCPP-Message-Timeline (`RemoteStart` → `StartTransaction` → Fehler).
  - Filter nach `TransactionID` und `ConnectorID`.
- **Akzeptanzkriterium:** Fehlerursache ohne DB-/CLI-Zugriff identifizierbar.
- **Status:** Geplant

---

## 4. User Experience & App-Logik

*Ziel: Reibungslose Interaktion zwischen Kunde und Hardware.*

### 4.1 Deep-Link Start/Stop Integration

- **Beschreibung:** Sofortige Steuerung aus der BC Charge App.
- **Technische Umsetzung:**
  - App Server → CitrineOS: `RemoteStartTransaction` / `RemoteStopTransaction`.
  - Berechtigung und Connector-Status vor Befehl validieren.
- **Akzeptanzkriterium:** Start/Stopp innerhalb von 2 Sekunden nach App-Klick.
- **Status:** ✅ Implementiert (App Server + Frontend)

### 4.2 Echtzeit-Ladekurven-Visualisierung

- **Beschreibung:** Live-Anzeige von Ladefortschritt und Leistung.
- **Technische Umsetzung:**
  - Hasura-Subscriptions / WebSockets für `MeterValues` (Power, Energy, SoC).
  - Live-Connector-Status: `src/api/citrineos/subscription.ts`
- **Akzeptanzkriterium:** Live-Graph der kW-Leistung während des Ladevorgangs.
- **Status:** Teilweise (Live-Status ✅; Kurven-Graph geplant)

### 4.3 Reservierungssystem

- **Beschreibung:** Kurzzeitige Reservierung eines Ladepunkts.
- **Technische Umsetzung:**
  - `Reservation`-State im Backend; RFID-Start außer reserviertem Nutzer abgelehnt.
  - Automatisches Aufheben nach X Minuten.
- **Akzeptanzkriterium:** Slot für 15 Minuten per App blockierbar.
- **Status:** Geplant

---

## 5. Roaming & Interoperabilität (Scale)

*Ziel: Integration in globale Lade-Netzwerke.*

### 5.1 OCPI-Bridge Erweiterung

- **Beschreibung:** Optimierter Datenaustausch für Roaming.
- **Technische Umsetzung:**
  - Mapping CitrineOS → OCPI v2.2.1.
  - Tarif-Export aus Dynamic Pricing Engine (`/api/pricing` → OCPI-Tariff).
- **Akzeptanzkriterium:** Korrekte Synchronisation von Status und Tarifen mit externen EMPs.
- **Status:** Teilweise (Tarif-Export ✅; Hub-Anbindung geplant)

### 5.2 Plug & Charge (ISO 15118) Bridge

- **Beschreibung:** Zertifikatsbasierte Identifikation.
- **Technische Umsetzung:**
  - Bridge für V2G-Root-Prüfung → `idTag` an CitrineOS.
- **Akzeptanzkriterium:** Ladevorgang ohne App/RFID nur über Fahrzeug-ID.
- **Status:** Geplant
