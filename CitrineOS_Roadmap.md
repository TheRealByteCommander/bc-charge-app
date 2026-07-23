# CitrineOS Feature Extensions - Technical Roadmap (OCPP 1.6)
**Project:** BC Charge CPO Backend Extension
**Objective:** Expand CitrineOS core capabilities to professional CPO standards.

---

## 1. Intelligentes Lastmanagement & Grid-Optimierung
*Ziel: Vermeidung von Netzüberlastung und Optimierung der Energiekosten.*

### 1.1 Dynamisches Lastmanagement (DLM)
- **Beschreibung:** Implementierung einer zentralen Steuerungslogik, die die verfügbare Gesamtleistung eines Standorts überwacht.
- **Technische Umsetzung:** 
    - Erstellung eines `LoadManager`-Services, der die Summe aller aktiven `MeterValues` (Power) aggregiert.
    - Bei Erreichen eines definierten Schwellenwerts (Hausanschlusswert) werden die Ladeleistungen der einzelnen Ladepunkte proportional reduziert.
    - **OCPP-Befehl:** Nutzung von `SetChargingProfile` (Smart Charging), um das `chargingProfile` dynamisch anzupassen.
- **Akzeptanzkriterium:** Keine Auslösung der Sicherung beim gleichzeitigen Laden aller Säulen; automatische Leistungsanpassung innerhalb von < 5 Sekunden.

### 1.2 Zeitgesteuerte Ladeoptimierung (Price-Driven)
- **Beschreibung:** Verschiebung der Ladezyklen in Zeitfenster mit niedrigen Strompreisen.
- **Technische Umsetzung:** 
    - API-Anbindung an Day-Ahead-Strompreisdaten (z.B. Entsoe-E).
    - Implementierung einer Logik, die Ladevorgänge pausiert oder drosselt, wenn der Preis einen Schwellenwert übersteigt, sofern keine "Eil-Ladung" vom Nutzer gewünscht wurde.
    - **OCPP-Befehl:** `SetChargingProfile` mit Zeitplänen (Schedules).
- **Akzeptanzkriterium:** Reduktion der Energiekosten pro kWh durch Verschiebung in Niedrigpreisphasen.

### 1.3 PV-Überschussladen
- **Beschreibung:** Priorisierung von lokal erzeugtem Solarstrom.
- **Technische Umsetzung:** 
    - Entwicklung eines API-Endpoints für externe Energiemanagementsysteme (EMS), um den aktuellen Solarüberschuss zu melden.
    - Die Ladeleistung wird linear an den gemeldeten Überschuss angepasst.
- **Akzeptanzkriterium:** Die Ladeleistung steigt/fällt synchron zum Solarertrag.

---

## 2. Billing & Monetarisierung (Deep Integration)
*Ziel: Maximierung der Marge und Automatisierung der Abrechnung.*

### 2.1 Dynamic Pricing Engine
- **Beschreibung:** Flexible Preisgestaltung jenseits von fixen kWh-Preisen.
- **Technische Umsetzung:**
    - **Zeitbasierte Tarife:** Implementierung einer Tarifmatrix (z.B. 06-22 Uhr: Preis A, 22-06 Uhr: Preis B).
    - **Idle Fees (Blockiergebühr):** Logik, die nach Ende des Ladevorgangs (`MeterValue` konstant oder `ChargingSession` beendet) einen Timer startet. Wenn das Fahrzeug nicht entfernt wird, wird eine minutengenaue Gebühr berechnet.
    - **Energie-Pass-through:** Dynamische Kalkulation: `Aktueller Strompreis + Betriebskosten + Marge`.
- **Akzeptanzkriterium:** Korrekte Berechnung von Idle-Fees in der Endabrechnung; dynamische Preisanpassung im Backend ohne manuellen Eingriff pro Säule.

### 2.2 Automatisierte Abrechnungs-Workflows
- **Beschreibung:** Nahtlose Übergabe der Finanzdaten in die Buchhaltung.
- **Technische Umsetzung:**
    - Erstellung eines Export-Moduls für DATEV/Lexoffice im CSV- oder XML-Format.
    - Aggregation von Transaktionen zu täglichen oder monatlichen Summen pro Standort.
- **Akzeptanzkriterium:** Export-Datei kann ohne manuelle Korrektur in die Buchhaltungssoftware importiert werden.

### 2.3 Multi-Tenant Revenue Sharing
- **Beschreibung:** Automatische Aufteilung von Einnahmen bei Partner-Standorten.
- **Technische Umsetzung:**
    - Einführung eines `LocationOwner`-Attributs in der Datenbank.
    - Implementierung einer Split-Logik: `Brutto-Umsatz - Kosten = Netto -> (X% Partner, Y% BC Charge)`.
- **Akzeptanzkriterium:** Automatische Erstellung von Abrechnungsberichten für Standortpartner.

---

## 3. Operations & Maintenance (Reliability Layer)
*Ziel: Maximierung der Uptime und Minimierung der Support-Kosten.*

### 3.1 Predictive Maintenance Dashboard
- **Beschreibung:** Früherkennung von Hardwaredefekten durch Musteranalyse.
- **Technische Umsetzung:**
    - Analyse von `StatusNotification` und `Error`-Events. 
    - Identifikation von "Flapping"-Verhalten (Säule geht ständig offline/online).
    - Alarmierung, wenn die Fehlerquote eines Modells über einen Zeitraum steigt.
- **Akzeptanzkriterium:** Dashboard zeigt "Warnung" für Säulen an, bevor ein Nutzer einen Totalausfall meldet.

### 3.2 Automatisierter Health-Check-Bot
- **Beschreibung:** Tägliche Validierung der Funktionsfähigkeit aller Ladepunkte.
- **Technische Umsetzung:**
    - Geplanter Cron-Job, der `GetDiagnostics` oder `GetStatus` an alle Säulen sendet.
    - Validierung der Antwortzeit und des Status.
    - Bei Timeout: Automatischer `Reset`-Befehl und bei erneutem Fehler Erstellung eines Tickets.
- **Akzeptanzkriterium:** Tägliche Liste aller "unhealthy" Säulen liegt vor dem ersten Kundenkontakt vor.

### 3.3 Remote Diagnostics Tool
- **Beschreibung:** Werkzeug für den Support zur schnellen Fehlerursachenanalyse.
- **Technische Umsetzung:**
    - Implementierung eines Log-Viewers, der OCPP-Messages in eine Timeline bringt (z.B. `Sende RemoteStart` $\rightarrow$ `Empfange StartTransaction` $\rightarrow$ `Fehler: ConnectorLocked`).
    - Filterung nach `TransactionID` und `ConnectorID`.
- **Akzeptanzkriterium:** Support-Mitarbeiter kann Fehlerursache ohne Zugriff auf die Datenbank/Kommandozeile identifizieren.

---

## 4. User Experience & App-Logik
*Ziel: Reibungslose Interaktion zwischen Kunde und Hardware.*

### 4.1 Deep-Link Start/Stop Integration
- **Beschreibung:** Sofortige Steuerung der Hardware aus der BC Charge App.
- **Technische Umsetzung:**
    - API-Endpunkt in CitrineOS, der einen `RemoteStartTransaction` bzw. `RemoteStopTransaction` Befehl an die entsprechende Säule triggert.
    - Validierung der Nutzerberechtigung und des Status des Connectors vor dem Befehl.
- **Akzeptanzkriterium:** Ladevorgang startet/stoppt innerhalb von 2 Sekunden nach App-Klick.

### 4.2 Echtzeit-Ladekurven-Visualisierung
- **Beschreibung:** Live-Anzeige des Ladefortschritts und der aktuellen Leistung.
- **Technische Umsetzung:**
    - Nutzung von WebSockets, um `MeterValues` (Power, Energy, SoC) in Echtzeit an die App zu pushen.
    - Aggregation der Daten in Zeitintervallen (z.B. alle 10 Sekunden).
- **Akzeptanzkriterium:** App zeigt einen Live-Graphen der kW-Leistung während des Ladevorgangs.

### 4.3 Reservierungssystem
- **Beschreibung:** Kurzzeitige Reservierung eines Ladepunkts.
- **Technische Umsetzung:**
    - Implementierung eines `Reservation`-States im Backend.
    - Logik: Wenn Status = `Reserved`, wird jeder RFID-Start außer dem reservierten Nutzers mit einem Fehler abgelehnt.
    - Automatisches Aufheben der Reservierung nach X Minuten.
- **Akzeptanzkriterium:** Nutzer kann via App einen Slot für 15 Minuten blockieren.

---

## 5. Roaming & Interoperabilität (Scale)
*Ziel: Integration in globale Lade-Netzwerke.*

### 5.1 OCPI-Bridge Erweiterung
- **Beschreibung:** Optimierung des Datenaustauschs für Roaming.
- **Technische Umsetzung:**
    - Mapping von CitrineOS-Datenmodellen auf den aktuellen OCPI-Standard (v2.2.1).
    - Implementierung von `Circulars` für Preisaktualisierungen an Roaming-Partner.
- **Akzeptanzkriterium:** Korrekte Synchronisation von Ladepunkt-Status und Tarifen mit externen EMPs.

### 5.2 Plug & Charge (ISO 15118) Bridge
- **Beschreibung:** Vorbereitung auf zertifikatsbasierte Identifikation.
- **Technische Umsetzung:**
    - Entwicklung einer Bridge, die die Zertifikatsprüfung (V2G-Root) übernimmt und das Ergebnis als `idTag` an CitrineOS übergibt.
    - Handling von `Authorization`-Requests spezifisch für PnC-Identifikatoren.
- **Akzeptanzkriterium:** Simulation eines Ladevorgangs ohne App/RFID, nur über Fahrzeug-ID.
