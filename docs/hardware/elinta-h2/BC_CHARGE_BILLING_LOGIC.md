# BC Charge Billing Logic: Eichrecht-Konforme Abrechnung via CitrineOS

Dieses Dokument beschreibt den technischen Workflow, um die MID-Zähler des Elinta CityCharge H2 rechtssicher in das Abrechnungssystem von BC Charge zu integrieren.

## 1. Datenfluss der Messung (Chain of Trust)

1. **Messung (Hardware):** Der Elinta H2 nutzt MID-konforme Zähler. Die Energie wird direkt an der Hardware gemessen.
2. **Übertragung (OCPP):** CitrineOS fordert via `MeterValues.conf` hochauflösende Samples an.
3. **Validierung (CitrineOS Server):** Das Backend prüft die Konsistenz der Zählerstände (Monotonie-Prüfung).
4. **Transaktionsschluss:** Beim Beenden der Session (`StopTransaction`) wird der finale Zählerstand als Grundlage für die Fakturierung gesetzt.
5. **Abrechnung (BC Charge App Server):** Die Dynamic Pricing Engine (`server/services/pricing/`) berechnet den Endbetrag aus dem **TariffSnapshot** und den Session-Ereignissen.

## 2. Eichrecht-Spezifika

- **Transparenz:** Nutzer sehen in der App den Zählerstand (kWh) vor und nach dem Ladevorgang.
- **Unveränderbarkeit:** Signierte MeterValues werden im `TariffSnapshot` als `meterProofs` unverändert referenziert.
- **Prüfprotokoll:** Jede Transaktion ist mit der Hardware-ID des Zählers verknüpft.
- **Hinweis:** Die App zertifiziert keine Messung selbst – sie zeigt CitrineOS/Hardware-Werte an.

## 3. Abrechnungsmodell (Dynamic Pricing Engine)

Tarifkomponenten werden bei Session-Start in einem **TariffSnapshot** eingefroren:

| Komponente | Beschreibung |
|------------|--------------|
| `energy` | Energiekosten basierend auf MID-`MeterValue` (bevorzugt `midCertified`) |
| `session` | Optionale Startgebühr |
| `time` | Zeitabhängige Gebühr während aktiven Ladens |
| `idle` | Blockiergebühr nach Ladeende (siehe Abschnitt 4) |
| `reservation` | Reservierungsgebühr (geplant) |

Legacy-Felder in CitrineOS Hasura `Tariff` (`pricePerKwh`, `pricePerMin`) dienen der Anzeige; die verbindliche Abrechnung folgt dem TariffSnapshot der App.

Dokumentation: [`docs/dynamic-pricing-engine.md`](../../dynamic-pricing-engine.md)

## 4. Idle Fees (Blockiergebühr)

Blockiergebühren werden **ausschließlich** aus OCPP-Ladezuständen abgeleitet, **nicht** aus konstanten MeterValues.

### Start einer Idle-Gebühr

1. Zuvor aktives Laden (`Charging` oder `EVConnected`).
2. Wechsel zu `SuspendedEV`, `SuspendedEVSE` oder `Idle` (Fahrzeug angesteckt, Laden beendet).
3. Nach Ablauf der konfigurierten Karenzzeit (`idleGraceSeconds`) wird die Idle-Komponente minutengenau berechnet.

### Keine Idle-Gebühr

- Konstante Energie-MeterValues ohne begleitenden `charging_state`-Wechsel.
- Standardtarife ohne `idle`-Komponente oder mit Rate `0`.

Implementierung: `deriveIdleIntervals()` in `server/services/pricing/events.mjs`.

## 5. Fehlerbehandlung & Ausfälle

- **Verbindungsabbruch:** H2 puffert lokal; nach Wiederherstellung Synchronisation über CitrineOS.
- **Zählerdifferenz:** Signifikante Abweichung → Session markieren, manuelle Ops-Prüfung.
- **Fehlende MeterValues:** Energie-Schätzung aus Ladezeit und Leistung (Fallback, siehe Session-Sync).

## 6. CitrineOS Server vs. App Server

| Aufgabe | Wo |
|---------|-----|
| OCPP, MeterValues, Zähler | CitrineOS Server (`bc-citrineos`) |
| TariffSnapshot, CostEngine, Stripe | BC Charge App Server (`server/`) |
| Anzeige, Live-Status | Frontend (`src/`) |
