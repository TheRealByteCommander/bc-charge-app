# Rollout-Checkliste: Elinta CityCharge H2 Inbetriebnahme

Diese Checkliste stellt sicher, dass jede BC Charge Ladesäule technisch perfekt und regulatorisch konform installiert wird.

## Phase 1: Physische Installation (Civil Works)
- [ ] **Fundament:** Bodenplatte gemäß Spezifikation gegossen und gelevelt.
- [ ] **HAK/Zuleitung:** Stromversorgung nach VDE-Norm verlegt.
- [ ] **Montage:** H2-Säule sicher befestigt, Kabel im Inneren ordnungsgemäß geführt.
- [ ] **Schutz:** Blitzschutz und Überspannungsschutz (SPD) gemäß IEC 61643-11 geprüft.

## Phase 2: Elektrische Inbetriebnahme
- [ ] **Spannungsprüfung:** Phase-Zuordnung (L1, L2, L3) und Neutralleiter geprüft.
- [ ] **Sicherungen:** RCD (Typ A/B) und Überstromschutz funktionsfähig.
- [ ] **Erdung:** Potenzialausgleich korrekt ausgeführt.

## Phase 3: Konnektivität & CitrineOS Integration
- [ ] **Netzwerk:** Ethernet/4G-Verbindung stabil; Ping-Test zum CitrineOS Gateway erfolgreich.
- [ ] **OCPP-Handshake:** Säule ist in CitrineOS sichtbar (`BootNotification` empfangen).
- [ ] **EVSEs & Connectors:** Im Operator UI oder per `seed-h2-connectors.sh` – Steckertyp **`IEC62196T2`** (Type 2 AC), Power Type **`AC_3_PHASE`**, je Connector 22 kW / 32 A / 400 V.
- [ ] **Konfiguration:** `ConfigurationKey` für MaxCurrent (32A) und Heartbeat-Intervall gesetzt.
- [ ] **Auth-Test:** Test-RFID-Karte und App-Start erfolgreich autorisiert.

## Phase 4: Regulatorische Abnahme (Deutschland)
- [ ] **Eichrecht-Check:** Zählerstand in der App stimmt mit dem Hardware-Zähler überein.
- [ ] **Labeling:** Alle erforderlichen Warnhinweise und Labels an der Säule angebracht.
- [ ] **Abnahme:** Protokoll der Inbetriebnahme unterzeichnet.

## Phase 5: Übergabe an Operations
- [ ] **Monitoring:** Heartbeat-Alarm in CitrineOS für diese Säule aktiv.
- [ ] **Branding:** LED-Farben und Display-Logos auf BC Charge Design geprüft.
