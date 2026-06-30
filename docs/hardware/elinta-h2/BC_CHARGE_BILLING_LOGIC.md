# BC Charge Billing Logic: Eichrecht-Konforme Abrechnung via CitrineOS

Dieses Dokument beschreibt den technischen Workflow, um die MID-Zähler des Elinta CityCharge H2 rechtssicher in das Abrechnungssystem von BC Charge zu integrieren.

## 1. Datenfluss der Messung (The Chain of Trust)
1. **Messung (Hardware):** Der Elinta H2 nutzt MID-konforme Zähler. Die Energie wird direkt an der Hardware gemessen.
2. **Übertragung (OCPP):** CitrineOS fordert via `MeterValues.conf` hochauflösende Samples an.
3. **Validierung (CitrineOS):** Das Backend prüft die Konsistenz der Zählerstände (Monotonie-Prüfung), um Manipulationen auszuschließen.
4. **Transaktionsschluss:** Beim Beenden der Session (`StopTransaction`) wird der finale Zählerstand als "Truth" für die Fakturierung gesetzt.

## 2. Eichrecht-Spezifika in CitrineOS
Um die deutsche Eichrechtsverordnung zu erfüllen, implementiert BC Charge in CitrineOS folgende Logik:
- **Transparenz:** Der Nutzer erhält in der App den exakten Zählerstand (kWh) vor und nach dem Ladevorgang.
- **Unveränderbarkeit:** Die Zählerwerte werden in einer unveränderlichen Log-Kette gespeichert.
- **Prüfprotokoll:** Jede Transaktion ist mit der Hardware-ID des H2-Zählers verknüpft.

## 3. Abrechnungsmodell (Standard CPO)
- **Energiekosten:** Basierend auf dem MID-Zählerwert.
- **Bereitstellungsgebühr:** Optionaler Fixbetrag pro Session.
- **Time-based Fee:** Zeitabhängige Komponente zur Deckung der Betriebskosten.
- **Netzgebühren:** Kalkuliert basierend auf dem versorgenden Netzbetreiber am Standort.

## 4. Fehlerbehandlung & Ausfälle
- **Verbindungsabbruch:** Bei einem Verbindungsverlust zwischen H2 und CitrineOS werden die Daten lokal im H2 gepuffert und nach Wiederherstellung synchronisiert.
- **Zählerdifferenz:** Weicht der Zählerstand signifikant von der berechneten Energie ab, wird die Session markiert und eine manuelle Prüfung durch das BC Charge Ops-Team ausgelöst.
