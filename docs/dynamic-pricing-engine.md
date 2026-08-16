# Dynamic Pricing Engine (Abrechnung)

Die **Dynamic Pricing Engine** berechnet Endkosten einer Ladesitzung deterministisch – unabhängig von der **Ladeoptimierung** (Price-Driven Charging, siehe [`price-driven-charging.md`](price-driven-charging.md)).

| Thema | Dynamic Pricing Engine | Price-Driven Charging |
|-------|------------------------|------------------------|
| Ziel | Abrechnung / Rechnung | Ladeleistung steuern |
| Host | BC Charge App Server | BC Charge App Server |
| OCPP | Liest States & MeterValues | Sendet `SetChargingProfile` |
| API | `/api/pricing` | `/api/price-optimization` |

## Architektur

```
Session-Start
    → attachTariffSnapshotToSession()   # Tarif einfrieren
    → pricing_snapshots (DB)

Session-Ende / Vorschau
    → SessionPricingEvents sammeln
    → deriveIdleIntervals() + computeCost()
    → pricing_ledger (DB) → Stripe / Rechnung
```

### Kernmodule (`server/services/pricing/`)

| Modul | Aufgabe |
|-------|---------|
| `tariffModel.mjs` | Tarifversionen, Komponenten, Validierung |
| `tariffSnapshot.mjs` | Unveränderlicher Snapshot pro Session |
| `sessionBinding.mjs` | Bindung Snapshot ↔ Session beim Start |
| `events.mjs` | Idle-Intervalle aus OCPP-Events |
| `costEngine.mjs` | Kostenberechnung (Energie, Zeit, Idle, Session) |
| `money.mjs` | Cent-genaue Rundung |
| `repository.mjs` | DB: `pricing_tariffs`, `pricing_tariff_versions`, `pricing_snapshots`, `pricing_ledger`, `pricing_tariff_audit` |

## Tarifkomponenten

| `kind` | Beschreibung | Einheit |
|--------|--------------|---------|
| `energy` | Energiepreis | €/kWh |
| `time` | Zeitabhängige Gebühr während Laden | €/Minute |
| `session` | Startgebühr (pauschal) | €/Session |
| `idle` | Idle/Blockier-Komponente (Engine-Support; **BC-Produktpolitik: nicht erheben**) | €/Minute |
| `reservation` | Reservierungsgebühr | €/Pauschal |

TOU-Fenster: `validFromLocal`, `validToLocal`, `weekdays` (1=Mo … 7=So), Zeitzone IANA (z. B. `Europe/Berlin`).

## Idle Fees – OCPP-State-Logik

**Produktpolitik BC Charge:** Es werden **keine** Blockier-/Standgebühren gegenüber Endkunden erhoben. Live-Tarife dürfen keine billable `idle`-Komponente enthalten; Kunden-Copy darf Idle-Fees nicht andeuten.

Die Engine kann Idle-Intervalle technisch weiterhin aus OCPP-States ableiten (Roaming/Zukunft). Idle wird **nicht** aus konstanten `MeterValues` abgeleitet.

### Ablauf

1. Session startet (`session_start` / `authorization`).
2. Fahrzeug lädt aktiv → OCPP-State `Charging` oder `EVConnected` (`wasCharging = true`).
3. Ladevorgang endet physisch, Fahrzeug bleibt angesteckt → State wechselt zu `SuspendedEV`, `SuspendedEVSE` oder `Idle`.
4. Ab diesem Zeitpunkt beginnt die Idle-Zeit (nach `idleGraceSeconds` Karenz).
5. Bei erneutem Laden (`Charging`) endet das Idle-Intervall.
6. Bei `session_stop` wird ein offenes Idle-Intervall geschlossen.

### Explizit ausgeschlossen

- Konstante Energie-MeterValues ohne begleitenden `charging_state`-Wechsel.
- Reine Pausen während `SuspendedEVSE` durch Netz/Lastmanagement **vor** dem ersten aktiven Laden.

Referenz: `deriveIdleIntervals()` in `server/services/pricing/events.mjs`.

## SessionPricingEvents

Chronologische Ereignisse für die CostEngine:

```json
{ "at": "2026-07-01T12:00:00.000Z", "type": "session_start" }
{ "at": "2026-07-01T12:05:00.000Z", "type": "charging_state", "chargingState": "Charging" }
{ "at": "2026-07-01T12:20:00.000Z", "type": "charging_state", "chargingState": "SuspendedEV" }
{ "at": "2026-07-01T12:35:00.000Z", "type": "meter_value", "energyWh": 8500, "midCertified": true }
{ "at": "2026-07-01T12:35:00.000Z", "type": "session_stop" }
```

## API (`/api/pricing`)

| Route | Beschreibung |
|-------|--------------|
| `GET /tariffs` | Alle Tarife |
| `GET /tariffs/:id/versions` | Versionen eines Tarifs |
| `POST /tariffs/:id/versions` | Neue Version (Draft) |
| `POST /tariffs/:id/versions/:vid/activate` | Version aktivieren |
| `POST /tariffs/:id/versions/:vid/rollback` | Rollback |
| `POST /preview` | Kostenvorschau mit Events |
| `GET /tariffs/:id/audit` | Änderungsprotokoll |
| `GET /sessions/:sessionId/snapshot` | Snapshot einer Session |

Session-Integration: `POST /api/sessions` ruft `attachTariffSnapshotToSession()` auf.

## Eichrecht

- Signierte MID-`MeterValues` werden im `TariffSnapshot` als `meterProofs` unverändert referenziert.
- `latestEnergyWh()` bevorzugt `midCertified: true`.
- Die App zertifiziert keine Messung selbst – sie zeigt CitrineOS/Hardware-Werte an.

## CitrineOS-Tarife vs. BC Pricing Engine

| | CitrineOS `Tariff` (Hasura) | BC Pricing Engine |
|--|----------------------------|-------------------|
| Zweck | Anzeige an Connector, einfache Felder | Versionierte Abrechnung |
| Idle | `pricePerMin` (legacy) | `kind: idle` + OCPP-State-Logik |
| Snapshot | Nein | Ja, pro Session |
| Verwaltung | Hasura / `scripts/citrineos/` | `/api/pricing`, `TariffsPage` |

Beide können parallel existieren; die Abrechnung folgt dem **TariffSnapshot** der Pricing Engine.

## Monetization-Module (integriert aus Prototype)

| Modul (Quelle) | App-Server-Pfad | API |
|----------------|-----------------|-----|
| `pricing-engine.ts` | `pricingEngine.mjs` | `POST /api/pricing/calculate-session` |
| `idle-timer-service.ts` | `idleTimerService.mjs` | `POST /api/pricing/idle/track`, `/idle/evaluate` |
| `billing-audit-logger.ts` | `billingAuditLogger.mjs` | `GET /api/pricing/audit/session/:id` |
| `revenue-share-manager.ts` | `revenueShareManager.mjs` | `POST /api/pricing/revenue-share/*` |

Anpassungen gegenüber dem Prototype:
- Cent-sichere `money.mjs`-Arithmetik statt Floating-Point
- Idle nur über OCPP-`charging_state` (nicht MeterValue-Heuristik)
- Audit in DB `billing_audit_log` mit HMAC-SHA256 (kein lokaler OpenClaw-Pfad)
- Revenue-Share-Agreements in DB

Vollständige Session-Abrechnung mit Snapshot bleibt `costEngine.computeCost()`.

## Tests

```bash
npm test
```

Golden-Master-Fälle: `server/services/pricing/goldenCases.mjs`  
Idle-Logik: `server/services/pricing/costEngine.test.mjs`  
Monetization: `server/services/pricing/monetization.test.mjs`
